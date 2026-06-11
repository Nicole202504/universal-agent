FROM python:3.12-slim

WORKDIR /app

# 系统依赖（pysweph 需要编译工具）
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ make \
    && rm -rf /var/lib/apt/lists/*

# Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 修复 PyJHora 缺失星历文件
COPY ephe/*.se1 /usr/local/lib/python3.12/site-packages/jhora/data/ephe/

# 应用代码
COPY vedic-api-server.py .
COPY scripts/ scripts/

# 暴露端口
EXPOSE 8000

# 启动
CMD ["uvicorn", "vedic-api-server:app", "--host", "0.0.0.0", "--port", "8000"]
