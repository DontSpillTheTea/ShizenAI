Write-Host "Pulling Llama3 model into Ollama container..."
docker compose exec ollama ollama pull llama3

Write-Host "Pulling nomic-embed-text model into Ollama container..."
docker compose exec ollama ollama pull nomic-embed-text

Write-Host "Models successfully pulled!"
