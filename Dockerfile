# syntax=docker/dockerfile:1

# =====================================================================
# CODIHA 用 Dockerfile
#
# 技術スタック: Node.js + Express + EJS + MySQL(mysql2)
# アプリ本体は Application/ 配下にある。
#
# 使い方（開発時）:
#   docker compose up
# 使い方（本番ビルドイメージを作る場合）:
#   docker build -t codiha:latest .
# =====================================================================

FROM node:20-alpine AS base

WORKDIR /app

ENV NODE_ENV=development

# ---- 依存関係インストール専用ステージ ----
# Application/package.json 等だけを先にコピーすることで、
# ソースコードの変更だけでは依存関係の再インストールが走らないようにする
FROM base AS deps
COPY Application/package.json Application/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---- 開発用ステージ ----
# compose.yaml はデフォルトでこのステージを使い、Application/ をマウントして
# nodemon によるホットリロード開発を行う
FROM deps AS dev
COPY Application/ .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---- 本番用ステージ ----
# 静的な public/ ・ views/ を含めたまま Node.js プロセスとして起動する
FROM deps AS production
ENV NODE_ENV=production
COPY Application/ .
EXPOSE 3000
CMD ["npm", "start"]
