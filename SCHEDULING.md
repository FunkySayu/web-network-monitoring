# Ping Scheduling Logic

The ping monitoring tool implements the following scheduling logic for its pings:

## Configuration

- `lower` bound: 200ms (default)
- `higher` bound: 2s (default)

## Cases

### 1. Short Cycle Case
If a ping completes in less than the `lower` bound (`t1 - t0 < lower`), the next ping is scheduled to start at `t0 + lower`. This ensures we don't spam the target too frequently.

### 2. Timeout Case
If a ping takes longer than the `higher` bound (`t0 + higher < now`), the ping is cancelled (timeout). An `ERROR` event is emitted, and a new ping is rescheduled immediately.

### 3. Normal Case
In all other cases, where the ping completes within the bounds and takes at least the `lower` bound to complete, the next ping is rescheduled immediately after completion.

## Event Data Format

Events are emitted in the following format:
`{timestamp: <server side timestamp>, target: fqdn/ip, event: START|COMPLETE|ERROR}`

- **COMPLETE**: Includes `startTime` and `deltaMs`.
- **ERROR**: Includes `startTime` and an `error` message string.
