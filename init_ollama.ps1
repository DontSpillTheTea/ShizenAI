Write-Host "Pulling Qwen2.5 model into Ollama container..."
docker compose exec ollama ollama pull qwen2.5:1.5b-instruct

Write-Host "Pulling nomic-embed-text model into Ollama container..."
docker compose exec ollama ollama pull nomic-embed-text

Write-Host "Models successfully pulled!"
