FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Force upgrade garth to bypass Garmin Cloudflare 429 errors.
# We do this separately because garminconnect officially pins garth<0.7.0.
RUN pip install --no-cache-dir "garth>=0.8.0"

COPY . .

ENV PYTHONPATH=/app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
