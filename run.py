#!/usr/bin/env python3
"""
Audio Scheduler Web App Launcher
Starts both backend and frontend servers simultaneously
"""

import subprocess
import sys
import os
import time
import signal
import threading

def run_command(command, cwd=None, name=""):
    """Run a command in a subprocess"""
    try:
        print(f"Starting {name}...")
        process = subprocess.Popen(
            command,
            shell=True,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        return process
    except Exception as e:
        print(f"Error starting {name}: {e}")
        return None

def main():
    print("Audio Scheduler Web App Launcher")
    print("=" * 40)

    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Backend directory
    backend_dir = os.path.join(script_dir, "backend")
    # Frontend directory
    frontend_dir = os.path.join(script_dir, "frontend")

    # Commands to run
    backend_cmd = "python app.py"
    frontend_cmd = "npm start"

    # Start backend
    backend_process = run_command(backend_cmd, backend_dir, "backend server")

    if backend_process is None:
        print("Failed to start backend server")
        return 1

    # Wait a bit for backend to start
    print("Waiting for backend to initialize...")
    time.sleep(5)

    # Start frontend
    frontend_process = run_command(frontend_cmd, frontend_dir, "frontend server")

    if frontend_process is None:
        print("Failed to start frontend server")
        backend_process.terminate()
        return 1

    print("\nBoth servers are running!")
    print("Backend: http://localhost:5000")
    print("Frontend: http://localhost:3000")
    print("\nPress Ctrl+C to stop both servers")

    try:
        # Keep running until interrupted
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping servers...")

    # Clean up
    if frontend_process:
        frontend_process.terminate()
    if backend_process:
        backend_process.terminate()

    print("Servers stopped.")
    return 0

if __name__ == "__main__":
    sys.exit(main())