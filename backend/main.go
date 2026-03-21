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

type PingResult struct {
	Target    string  `json:"target"`
	Latency   string  `json:"latency"`
	Timestamp string  `json:"timestamp"`
	Error     string  `json:"error,omitempty"`
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

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			log.Printf("Context cancelled for target: %s", target)
			return
		case <-ticker.C:
			latency, err := ping(ctx, target)
			result := PingResult{
				Target:    target,
				Latency:   latency,
				Timestamp: time.Now().Format(time.RFC3339),
			}
			if err != nil {
				result.Error = err.Error()
			}

			message, _ := json.Marshal(result)
			if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Write error: %v", err)
				return
			}
		}
	}
}

func main() {
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
