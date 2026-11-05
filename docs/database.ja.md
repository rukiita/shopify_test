# データベース設計

[English](database.md) | 日本語

> これは [database.md](database.md) の翻訳です。内容が異なる場合は英語版を優先してください。

ER 図と主な選択は [README](../README.ja.md#データベース) にあります。このファイルにはそれ以外を記載します。

データベースは SQLite で、Prisma(`prisma/schema.prisma`)で管理します。注文、明細、商品は Shopify のデータのコピーで、データの所有者は Shopify です([タグを先に Shopify に書き込む理由](adr/0004-sync-tags-to-shopify.md))。コピーは 4 つの方法で書き込まれます。

- **取り込み:** `orders/create` または `orders/updated` の Webhook、または既存の注文の同期([ステップ 6](setup.ja.md#6-既存の注文をインポートする))が、注文を再取得(Admin API から読み直すこと)し、注文とその明細、商品を書き込みます。注文と明細は、Shopify の `updatedAt` が保存済みの `shopifyUpdatedAt` より古くない限り書き込みます(同じ値は書き込みます。`updatedAt` は 1 秒単位なので、同じ秒の後の変更を含む可能性があるからです)。これは、同じ注文の取得が 2 つ同時に走る場合への備えです([アプリが各注文を再取得する理由](adr/0003-refetch-order-via-graphql.md))。各商品も同じように、商品自体の `updatedAt` が保存済みの `shopifyUpdatedAt` より古くない限り書き込みます。同じ商品を含む 2 つの注文が同時に取り込まれる場合があるからです
- **タグの編集:** アプリで注文タグを追加または削除すると、先に Shopify に書き込み、次にデータベースに書き込みます([タグを先に Shopify に書き込む理由](adr/0004-sync-tags-to-shopify.md))
- **コンプライアンス Webhook:** `customers/redact` は注文の顧客フィールドを空にし、`shop/redact` はアンインストールされたショップのデータを削除します([顧客データ](#顧客データ)を参照)
- **削除:** アプリは Shopify の削除 Webhook(`orders/delete`、`products/delete`)をサブスクライブしていないので、Shopify での削除は受信しません([設計上の選択](#設計上の選択)の「削除時の動作」を参照)

## テーブル

| テーブル | 保持するもの | 備考 |
|---|---|---|
| `Order` | Shopify の注文ごとに 1 行。ショップ単位 | `customerAddress` は書式を整えた 1 つの文字列です(配送先。なければ請求先)。`customers/redact` は `customerEmail`、`customerFullName`、`customerAddress` を null にし、`customerRedacted` を true にします。以後の取り込みでも 3 つのフィールドは null のままです([顧客データ](#顧客データ)を参照) |
| `LineItem` | 注文の明細ごとに 1 行 | その注文を最後に取り込んだときに明細に商品がなければ、`productId` は null です。カスタム明細や、Shopify で削除済みの商品の場合です |
| `Product` | 取り込んだ注文に現れた商品ごとに 1 行。ショップ単位 | その商品を含む注文と一緒に取得したタイトルとタグで、そのような注文を取り込むたびに書き込みます。`shopifyUpdatedAt` は Shopify での商品の `updatedAt` なので、そのような取り込みが 2 つ同時に走っても、古い取得で新しいものを上書きしません。`app/uninstalled` と `shop/redact` はショップの商品を削除します |
| `Session` | Shopify の OAuth セッション。アプリテンプレート由来 | テンプレートから変更していません。他のテーブルとは関連がないので、図には含めていません |

## 設計上の選択

**Shopify の GID を主キーにしています**(`gid://shopify/Order/...`、`.../LineItem/...`、`.../Product/...`)。

- Webhook には GID(`admin_graphql_api_id`)が含まれ、GraphQL の再取得([アプリが各注文を再取得する理由](adr/0003-refetch-order-via-graphql.md))はそれをそのまま受け取ります
- 同じオブジェクトを 2 回 upsert しても同じ行に当たるので、同じ Webhook が繰り返し届いても重複は生じません
- アプリの ID と Shopify の ID の対応付けは不要です

**`Product` は別テーブルです。** 商品は注文をまたいで多くの明細に共有され、CSV には明細が持つ値ではなく商品自体のタイトルとタグが必要です([課題の解釈](interpretation.ja.md#課題の解釈)を参照)。商品ごとに 1 回保存することで、その商品のどの明細にも同じ値が表示されます。値が更新されるのは、その商品を含む注文が取り込まれたときで、商品自体が変わったときではありません。`LineItem.title` は購入時のタイトルを、明細に商品がないときのフォールバックとして保持します。

**削除時の動作。** アプリは `orders/create`、`orders/updated`、`app/uninstalled` と、コンプライアンス Webhook の `customers/data_request`、`customers/redact`、`shop/redact` をサブスクライブしています。どれも注文や商品の削除を通知しないので、Shopify で削除してもここの行は削除されません。`app/uninstalled` は、署名されたペイロードがそのショップを指している配信のたびに、ショップの注文、明細、商品、セッションを削除します([顧客データ](#顧客データ)を参照)。アンインストールの 48 時間後に Shopify が送る `shop/redact` は、ショップの注文、明細、商品を再度削除するので、`app/uninstalled` の後に書き込まれたものも削除されます。その 48 時間のうちにアプリが再度インストールされていれば、`shop/redact` は何も削除しません。`customers/redact` が変更する内容は[顧客データ](#顧客データ)にあります。

Shopify で削除された商品が反映されるのは、その後に再び取り込まれた注文だけです。削除された商品について、再取得は商品を返しません(`product: null`。#6 で取得したレスポンスで確認済み)。そのため `productId` は null になり、CSV は購入時のタイトルにフォールバックします。その商品を含む他の注文には、保存済みのタイトルとタグが表示され続けます。

外部キーは、アプリのデータベースで行を削除したときの動作を定めます。注文を削除すると、その明細も削除されます(`onDelete: Cascade`)。商品を削除すると、明細は残り、`productId` が null になります(`onDelete: SetNull`)。そのため、注文と購入時のタイトルは CSV に残ります。`app/uninstalled` と `shop/redact` は、ショップの注文(明細も一緒に削除されます)と商品を削除します。

**タグと決済ゲートウェイは、String 列に入れた JSON 配列です**。たとえば `["VIP","wholesale"]`。SQLite に配列型はありません。JSON なら、値にどの文字が含まれていても曖昧になりません(カンマ区切りの文字列ではそうなりません)。タグの追加や削除も配列の操作で済みます。タグでの SQL の絞り込みは、現在の要件では不要です。

**注文の合計金額は、通貨の最小単位の整数です**(`totalPriceMinor`: 11.99 USD → `1199`、1500 JPY → `1500`)。`currencyCode` とともに保存します。String 列は Prisma の `_sum` で合計できず、SQLite 上の Prisma の `Decimal` は浮動小数点の REAL として保存されるので、合計金額を整数で保持します。注文をまたぐ合計は通貨ごとに計算します。列は `BigInt` で、Prisma は JavaScript の `bigint` として返します。32 ビットの `Int` では 1 注文の上限が 2,147,483,647 最小単位(約 2,100 万 USD。KWD のような小数 3 桁の通貨では約 210 万)になり、それを超える注文が 1 つあると、その行を返すすべてのクエリが失敗します。

**インデックス。** `Order(shop, shopifyCreatedAt)` は注文一覧(ショップの注文を新しい順に)に使います。SQLite は外部キーに自動でインデックスを作らないので、`LineItem(orderId)` と `LineItem(productId)` にインデックスを張っています。`Product(shop)` は外部キーのインデックスではありません(`shop` は通常の列です)。`app/uninstalled` と `shop/redact` でショップの商品を削除するときに使います。

## 顧客データ

アプリは 3 つの顧客フィールド `customerEmail`、`customerFullName`、`customerAddress` を、`Order` にのみ保存します。これらはマーチャント自身の Shopify の注文からコピーしたものです。他のテーブルは顧客データを持たず、Shopify の顧客 ID も保存しません。

Shopify は、App Store への掲載の有無にかかわらず、すべての公開アプリに 3 つのコンプライアンス Webhook の処理を求めています。このアプリは `shopify.app.toml`(`compliance_topics`)でこれらをサブスクライブしています。各ルートは HMAC 署名を検証し、無効なら 401 を返します。ショップは署名の対象外である `X-Shopify-Shop-Domain` ヘッダーから得るので、2 つの redaction ルートは、署名されたペイロードの `shop_domain` が別のショップを指している場合にも 401 を返します。それ以外の場合、各ルートは次の処理の後に 200 を返します。

| トピック | Shopify が送るタイミング | アプリの動作 |
|---|---|---|
| `customers/redact` | マーチャントが顧客データの削除を依頼してから 10 日後 | `orders_to_redact` に列挙された、そのショップの注文の顧客フィールド 3 つを null にし、`customerRedacted` を設定します。そのような注文を後で取り込んでも(たとえば返金後の `orders/updated`)、Shopify が何を返しても 3 つのフィールドは null のままです。注文、明細、タグは Shopify と同じく残ります。列挙された注文のうち、アプリが保存していないものは飛ばします |
| `shop/redact` | アプリのアンインストールから 48 時間後 | `app/uninstalled` と同じく、ショップの注文、明細、商品を削除します。ショップに再びセッションがある場合(その 48 時間のうちにアプリが再度インストールされた場合)は何も削除しません。`app/uninstalled` がセッションを削除するので、その時点のデータは新しいインストールのものだからです。再インストールで `shop/redact` が取り消されるかどうかは、Shopify のドキュメントに書かれていません |
| `customers/data_request` | 顧客がマーチャントに自分のデータを求めたとき | トピックとショップをログに記録するだけで、顧客の詳細は記録しません。アプリは顧客に何も送りません。保存しているフィールドはマーチャント自身の注文のコピーなので、マーチャントは Shopify 管理画面で既に見ることができます。アプリの注文一覧には氏名とメールアドレスが表示され、CSV エクスポートには 3 つすべてが含まれます |

注文は ID のみで照合します(`orders_to_redact` の数値 ID を GID に変換します。GID は `gid://shopify/Order/…` のような Shopify のグローバル ID です)。アプリが顧客 ID を保存していないからです。一覧にない注文の顧客データは残ります。ルートにセッションは不要なので、アプリのアンインストール後も redaction は実行されます。

`app/uninstalled` はコンプライアンス Webhook ではありませんが、同じデータを削除し、同じチェックがあります。署名されたペイロードの `myshopify_domain` がヘッダーのショップでなければ、401 を返して何も削除しません。開発ストアから取得した実際の配信では、このフィールドにショップのドメインが入っていますが、Shopify のドキュメントのサンプルでは null です。

ルートを手動で確認するには、アプリを実行し(`npm run dev`)、`npx shopify app webhook trigger --topic customers/data_request`(または `customers/redact`、`shop/redact`)で Shopify のサンプルペイロードを送ります。尋ねられたら、アプリのローカルアドレスとクライアントシークレットを入力します。`customers/data_request` は 200 を返します。2 つの redaction ルートは、サンプルに対して 401 を返します。サンプルの `shop_domain` はプレースホルダーの `{shop}.myshopify.com` で、ヘッダーのショップと一致しないからです。redaction 自体はルートのテスト(`test/routes/webhooks.customers.redact.test.ts`、`test/routes/webhooks.shop.redact.test.ts`)で確認しています。

`app/uninstalled` もサンプルを拒否します。サンプルは `"myshopify_domain": null` なので、`--topic app/uninstalled` での 401 は想定どおりです。`npm run dev` は、アプリのクライアント ID が前回の実行と異なるとき(初回の実行と `config:link` 後の実行を含みます)、この種のサンプルを自動でルートに送ります。このとき CLI は `APP_UNINSTALLED webhook delivery failed` と表示し、ローカルのデータは残ります。
