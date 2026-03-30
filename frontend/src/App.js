import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import './App.css';
import PingCanvas from './PingCanvas';

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const target = searchParams.get('target') || '';
  const [inputValue, setInputValue] = useState(target);
  const [lastEvent, setLastEvent] = useState(null);
  const [ws, setWs] = useState(null);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams({ target: inputValue });
  };

  const connectWebSocket = useCallback((targetToPing) => {
    if (ws) {
      ws.close();
    }

    if (!targetToPing) return;

    // Use environment variable for backend URL if needed, default to localhost for development
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'ws://localhost:8080';
    const newWs = new WebSocket(`${backendUrl}/ws?target=${encodeURIComponent(targetToPing)}`);

    newWs.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLastEvent(data);
    };

    newWs.onclose = () => {
      console.log('WebSocket closed');
    };

    setWs(newWs);
  }, [ws]);

  useEffect(() => {
    if (target) {
      connectWebSocket(target);
    } else {
      if (ws) {
        ws.close();
        setWs(null);
      }
      setLastEvent(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <div className="App">
      <header className="App-header-small">
        <form onSubmit={handleSearch}>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="FQDN or IP to ping"
            data-testid="target-input"
          />
          <button type="submit">Ping</button>
        </form>
      </header>
      <main>
        {target && <PingCanvas lastEvent={lastEvent} />}
      </main>
    </div>
  );
}

export default App;
