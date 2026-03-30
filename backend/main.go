package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for this project
	},
}

type PingEvent struct {
	Timestamp string `json:"timestamp"`
	Target    string `json:"target"`
	Event     string `json:"event"`
	StartTime string `json:"startTime,omitempty"`
	DeltaMs   int64  `json:"deltaMs"`
	Error     string `json:"error,omitempty"`
}

func ping(ctx context.Context, target string) (string, error) {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, "ping", "-n", "1", target)
	} else {
		cmd = exec.CommandContext(ctx, "ping", "-c", "1", target)
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", err
	}

	// Simple extraction of latency from ping output
	// This is a bit naive and depends on the ping implementation,
	// but for a minimal setup it should suffice.
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "time=") {
			parts := strings.Split(line, "time=")
			if len(parts) > 1 {
				latency := strings.Split(parts[1], " ")
				return latency[0], nil
			}
		}
	}

	return "unknown", nil
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade error: %v", err)
		return
	}
	defer conn.Close()

	target := r.URL.Query().Get("target")
	if target == "" {
		log.Println("No target specified")
		return
	}

	log.Printf("Starting pings for target: %s", target)

	lower := 200 * time.Millisecond
	higher := 2 * time.Second

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			log.Printf("Context cancelled for target: %s", target)
			return
		default:
			t0 := time.Now().UTC()
			t0Str := t0.Format("2006-01-02T15:04:05.000Z")

			// Emit START
			startEvent := PingEvent{
				Timestamp: t0Str,
				Target:    target,
				Event:     "START",
			}
			if err := sendEvent(conn, startEvent); err != nil {
				return
			}

			// Ping with timeout
			pingCtx, cancel := context.WithTimeout(ctx, higher)
			_, err := ping(pingCtx, target)
			cancel()

			t1 := time.Now().UTC()
			t1Str := t1.Format("2006-01-02T15:04:05.000Z")

			isTimeout, err := emitResultEvent(conn, target, err, pingCtx, t0Str, t1Str, t1.Sub(t0))
			if err != nil {
				return
			}

			// Scheduling logic
			if isTimeout {
				// Timeout case: reschedule immediately
				continue
			}

			elapsed := t1.Sub(t0)
			if elapsed < lower {
				// Short cycle case
				select {
				case <-ctx.Done():
					return
				case <-time.After(lower - elapsed):
					// continue
				}
			}
			// Normal case: reschedule immediately
		}
	}
}

func emitResultEvent(conn *websocket.Conn, target string, pingErr error, pingCtx context.Context, t0Str, t1Str string, elapsed time.Duration) (bool, error) {
	isTimeout := false
	if pingErr != nil {
		// ERROR case
		errStr := pingErr.Error()
		if pingCtx.Err() == context.DeadlineExceeded {
			errStr = "timeout"
			isTimeout = true
		}
		errorEvent := PingEvent{
			Timestamp: t1Str,
			Target:    target,
			Event:     "ERROR",
			StartTime: t0Str,
			Error:     errStr,
		}
		return isTimeout, sendEvent(conn, errorEvent)
	}

	// COMPLETE case
	completeEvent := PingEvent{
		Timestamp: t1Str,
		Target:    target,
		Event:     "COMPLETE",
		StartTime: t0Str,
		DeltaMs:   elapsed.Milliseconds(),
	}
	return isTimeout, sendEvent(conn, completeEvent)
}

func sendEvent(conn *websocket.Conn, event PingEvent) error {
	message, err := json.Marshal(event)
	if err != nil {
		return err
	}
	if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
		log.Printf("Write error: %v", err)
		return err
	}
	return nil
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)
	http.HandleFunc("/ws", handleWebSocket)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}
