# syntax=docker/dockerfile:1

# =====================================================================
# CODIHA 用 Dockerfile（汎用テンプレート）
#
# まだ技術スタックが確定していないため、Node.js（Vite/React/Next.js等）の
# フロントエンドアプリを想定した汎用構成にしています。
# 実際に使うフレームワークが決まったら、コメントを参考に調整してください。
#
# 使い方（開発時）:
#   docker compose up
# 使い方（本番ビルドイメージを作る場合）:
#   docker build -t codiha:latest .
# =====================================================================

# ---- ベースイメージ ----
# Node.js の LTS を使用。alpine系は軽量だが、ネイティブモジュールを使う
# 場合はビルドツール不足でエラーになることがあるので、その場合は
# "node:20-bookworm-slim" 等に変更してください。
FROM node:20-alpine AS base

WORKDIR /app

# apk のパッケージキャッシュ等を最小限にする
ENV NODE_ENV=development

# ---- 依存関係インストール専用ステージ ----
# package.json / package-lock.json だけを先にコピーすることで、
# ソースコードの変更だけでは依存関係の再インストールが走らないようにする
FROM base AS deps
COPY package.json package-lock.json* ./
# package.json がまだ存在しない場合はこのステップでエラーになります。
# `npm init` 等でプロジェクトを作成してから改めて build してください。
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---- 開発用ステージ ----
# compose.yaml はデフォルトでこのステージを使い、ソースをマウントして
# ホットリロード開発を行う
FROM deps AS dev
COPY . .
EXPOSE 5173
# Vite のデフォルトポート(5173)を想定。Next.js等を使う場合は
# 3000番に変更し、下記コマンドも "npm run dev" 等に合わせて調整してください。
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---- 本番ビルド用ステージ ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- 本番配信用ステージ（静的ファイルを nginx で配信） ----
FROM nginx:1.27-alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ---------------------------------------------------------------------
# Python(Flask/Django)等でバックエンドを作る場合の参考（別ファイル推奨）:
#
#   FROM python:3.12-slim
#   WORKDIR /app
#   COPY requirements.txt .
#   RUN pip install --no-cache-dir -r requirements.txt
#   COPY . .
#   CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
#
# バックエンドを別コンテナにする場合は backend/Dockerfile のように
# 分割し、compose.yaml にサービスを追加してください。
# ---------------------------------------------------------------------
