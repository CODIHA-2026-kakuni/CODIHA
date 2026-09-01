# CODIHA 試作品

千葉市内の小型家電回収ボックスを、現在地から近い順に探すための試作品です。

## Dockerについて

このフォルダでは、次の2つをDockerで同時に動かします。

- `web`: 画面とAPIを提供するNode.js／Expressアプリ
- `db`: 30か所の回収場所を保存するMySQL

`compose.yaml`が2つの起動順序や接続方法をまとめています。MySQLのデータは`db_data`というDockerボリュームに保存されるため、コンテナを停止しても残ります。

## 起動方法

1. Docker Desktopを起動します。
2. ターミナルでこの`prototype`フォルダを開きます。
3. 環境設定ファイルを用意します。

   ```bash
   cp .env.example .env
   ```

4. WebアプリとMySQLを起動します。

   ```bash
   docker compose up --build
   ```

5. ブラウザで <http://localhost:3000> を開きます。

終了するときは、ターミナルで`Ctrl+C`を押してから次を実行します。

```bash
docker compose down
```

## 使い方

- 最初は千葉市内の全30拠点が表示されます。
- 「現在地から探す」を押し、ブラウザの位置情報を許可すると、直線距離が近い順に並び替わります。
- 位置情報を許可しない場合でも、全拠点の地図と一覧は利用できます。
- 「Googleマップで経路」を押すと、選んだ施設までの経路検索を別画面で開きます。

## データ

- 回収場所・利用時間: [千葉市「小型家電とリチウムイオン電池などの充電式電池の回収」](https://www.city.chiba.jp/kankyo/junkan/haikibutsu/kogatakadenn.html)（2026年8月7日確認）
- 緯度・経度: [千葉市「公共施設位置情報」](https://www.city.chiba.jp/sogoseisaku/shichokoshitsu/kohokocho/map_opendata.html)（2025年6月27日時点、CC BY 4.0）
- 地図: OpenStreetMap

データは起動時に外部サイトから取得せず、`db/init.sql`からMySQLへ登録します。

## テスト

Node.jsがインストールされている環境では、次の操作で距離計算とAPIのテストを実行できます。

```bash
npm install
npm test
```

## 試作品で対応していないこと

- 品目名からの検索
- 充電池や携帯電話・パソコン専用の回収可否判定
- 道路に沿った移動距離・移動時間の計算
- 営業中／営業時間外の自動判定
- 管理画面、ログイン機能

