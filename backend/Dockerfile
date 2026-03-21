# Build stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o main .

# Run stage
FROM alpine:latest

# Install iputils to have the ping command
RUN apk add --no-cache iputils

WORKDIR /app

COPY --from=builder /app/main .

EXPOSE 8080

CMD ["./main"]
