import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Mock WebSocket
class MockWebSocket {
  constructor(url) {
    this.url = url;
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }
  send(data) {}
  close() {}
}
global.WebSocket = MockWebSocket;

// Mock Worker
class MockWorker {
  constructor(stringUrl) {
    this.url = stringUrl;
    this.onmessage = null;
    this.terminate = jest.fn();
    this.postMessage = jest.fn();
  }
}
global.Worker = MockWorker;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock HTMLCanvasElement.prototype.transferControlToOffscreen
HTMLCanvasElement.prototype.transferControlToOffscreen = jest.fn().mockImplementation(() => {
  return {}; // Return a dummy offscreen canvas
});

const renderWithRouter = (ui) => {
  return render(ui, { wrapper: BrowserRouter });
};

describe('App Component', () => {
  test('updates URL when input is applied and button clicked', () => {
    renderWithRouter(<App />);
    const input = screen.getByTestId('target-input');
    const button = screen.getByText('Ping');

    fireEvent.change(input, { target: { value: 'google.com' } });
    fireEvent.click(button);

    expect(window.location.search).toBe('?target=google.com');
  });

  test('creates a new WebSocket with correct parameters when URL is updated', async () => {
    const originalWebSocket = global.WebSocket;
    const mockWsConstructor = jest.fn().mockImplementation((url) => {
      return new MockWebSocket(url);
    });
    global.WebSocket = mockWsConstructor;

    renderWithRouter(<App />);

    // Update URL by clicking the button
    const input = screen.getByTestId('target-input');
    const button = screen.getByText('Ping');
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.click(button);

    // Check if WebSocket was called with the correct URL
    // We might need to wait for useEffect to trigger
    expect(mockWsConstructor).toHaveBeenCalledWith(expect.stringContaining('target=example.com'));

    global.WebSocket = originalWebSocket;
  });

  test('forwards data to the canvas worker when data is emitted on the websocket', async () => {
    let messageCallback;
    const mockPostMessage = jest.fn();

    class MockWebSocketWithMessage extends MockWebSocket {
      constructor(url) {
        super(url);
        messageCallback = (data) => {
           if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
        };
      }
    }

    const originalWorker = global.Worker;
    global.Worker = jest.fn().mockImplementation(() => {
        return {
            postMessage: mockPostMessage,
            terminate: jest.fn()
        };
    });

    global.WebSocket = MockWebSocketWithMessage;

    renderWithRouter(<App />);

    // Trigger URL update to start connection
    const input = screen.getByTestId('target-input');
    const button = screen.getByText('Ping');
    fireEvent.change(input, { target: { value: 'test.com' } });
    fireEvent.click(button);

    // Simulate incoming message
    const mockPingEvent = {
      timestamp: '2023-10-27T10:00:05Z',
      target: 'test.com',
      event: 'COMPLETE',
      startTime: '2023-10-27T10:00:00Z',
      deltaMs: 5000,
    };

    act(() => {
      messageCallback(mockPingEvent);
    });

    // Check if postMessage was called with the event
    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'event',
        data: mockPingEvent
    }));

    global.Worker = originalWorker;
  });
});
