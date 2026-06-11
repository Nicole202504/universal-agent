FROM python:3.12-slim
WORKDIR /app
COPY python-api/requirements.txt .
RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ make && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt
COPY python-api/ephe/*.se1 /usr/local/lib/python3.12/site-packages/jhora/data/ephe/
COPY python-api/vedic-api-server.py .
COPY python-api/scripts/ scripts/
EXPOSE 8000
CMD ["uvicorn", "vedic-api-server:app", "--host", "0.0.0.0", "--port", "8000"]
