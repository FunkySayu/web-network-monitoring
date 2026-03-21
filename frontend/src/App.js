import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import './App.css';

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  const target = searchParams.get('target') || '';
  const [inputValue, setInputValue] = useState(target);
  const [pings, setPings] = useState([]);
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
      setPings((prev) => [data, ...prev]);
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
      setPings([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return (
    <div className="App">
      <header className="App-header">
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
        <div data-testid="pings-list">
          {pings.map((ping, index) => (
            <div key={index} className="ping-line">
              {ping.timestamp}: {ping.target} - {ping.latency} ms {ping.error ? `(Error: ${ping.error})` : ''}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
