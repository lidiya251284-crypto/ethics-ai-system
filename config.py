"""Configuration for the Ethics AI System."""

import os

# Server
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", 5000))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

# Search
SEARCH_TOP_K = int(os.getenv("SEARCH_TOP_K", 8))

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
