FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/openjarvis_service

ENV PORT=8100
ENV HOST=0.0.0.0
EXPOSE 8100

CMD ["python3", "-m", "openjarvis_service.server"]
