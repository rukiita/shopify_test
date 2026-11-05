# 既知の制限事項 / 本番環境での考慮事項

[English](known-limitations.md) | 日本語

> これは [known-limitations.md](known-limitations.md) の翻訳です。内容が異なる場合は英語版を優先してください。

全項目の一覧です。主な項目は [README](../README.ja.md#既知の制限事項--本番環境での考慮事項) にあります。

## スコープの判断

- アプリは Shopify App Store に申請していません。Shopify が求めるコンプライアンス Webhook は実装済みですが([顧客データ](database.ja.md#顧客データ)を参照)、保護された顧客データのリクエストのステップ 2(データ保護の詳細)と App Store の審査は行っていません
- リポジトリに Dockerfile などのデプロイ設定はありません。アプリは `npm run dev` でローカルで実行します
- CI はありません。リポジトリに GitHub Actions のワークフローがなく、テスト、コードレビュー、セキュリティレビューはローカルで実行します
- CSV エクスポートは、ショップの全注文を読み、1 つのリクエスト内でメモリ上にファイルを作ります。大規模なストアでは測定していません。読み取りは 1 つの SQLite 接続を共有し、ファイルの作成は Node プロセスを占有します。そのため、その間すべてのショップの注文 Webhook が待たされ、Shopify の 5 秒の制限を超えて Shopify の再試行に委ねられる場合があります。大規模なストアについては[行 6](#6-大きなデータ)を参照してください(#5)
- 保存するのは注文の最初の 250 明細だけです(GraphQL の 1 ページ、`lineItems(first: 250)`)。それを超える明細は保存されず、CSV にも入りません(#1)
- 注文の Webhook はリクエスト内で処理します。アプリは応答する前に注文を取得して保存します([Webhook をリクエスト内で処理する理由](adr/0005-process-webhooks-synchronously.md))。1 回の配信にかかる時間は、Shopify の 5 秒の制限に対して約 0.5 秒です。データベースの書き込みは 1 つの SQLite 接続で 1 つずつ実行するので、同時に届いた配信は互いを待ちます(#77)。大きな注文で約 75 件、小さな注文で約 170 件を超えて一度に届くと(データベースの書き込みだけで測定した値で、ルートを通すともっと少ない可能性があります)、一部が失敗して Shopify の再試行に委ねられます。本番環境については[行 1 〜 3](#本番環境への移行)を参照してください。照合ジョブの予定はありません。同期([ステップ 6](setup.ja.md#6-既存の注文をインポートする))は手動で実行でき、過去 60 日間の注文のうち、欠けているものと変更があったものをインポートします
- `customers/data_request` はリクエストをログに記録するだけです。Shopify は、要求されたデータを 30 日以内にストアのオーナーに直接提供するようアプリに求めています([privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance))。本番環境については[行 5](#5-顧客データ)を参照してください(#98)
- アクセストークンと顧客データは、SQLite に暗号化せず保存しています(`Session`、`Order`)。アプリは氏名、メールアドレス、住所を使うので、Shopify の保護された顧客データの要件ではレベル 2 にあたり、その要件には保存時の暗号化が含まれます([protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data))。本番環境については[行 5](#5-顧客データ)を参照してください(#98)
- 既存の注文の同期は、1 つのリクエスト内で 1 注文ずつ実行します。注文を 250 件ずつ一覧し、新しい注文と変更があった注文を Webhook と同じように取得して書き込みます。かかる時間はインポートする注文の数に比例します(同じ取得と書き込みは Webhook の配信 1 回あたり約 0.5 秒です。同期自体は大規模なストアで測定していません)。Shopify が 429 または 503 で応答したリクエストは、最大 3 回試行します。GraphQL のレート制限はステータス 200 の `THROTTLED` エラーとして報告され、再試行しません。同期は止まり、それまでにインポートした注文は残り、再度実行するとまだインポートしていない注文から続行します。複数の注文の同時取得はしていません(#70)。大規模なストアについては[行 6](#6-大きなデータ)を参照してください(#21)

## 既知の問題

- `read_customers` は最初のインストールの後に追加しました(#1)。それ以前にインストールしたストアでは、マーチャントがアプリを開いて新しいスコープを承認するまで、このスコープがありません。それまでは注文のクエリが拒否され、そのストアの注文 Webhook は失敗して再試行されます
- CSV に通貨の列はありません。*Total price* は注文を最後に取り込んだときのショップの通貨なので、ショップが通貨を変更すると、列に複数の通貨が混在する場合があります(#5)
- *Order id* は 13 桁以上の単純な数値です。Excel では指数表記で表示され、Excel からファイルを保存すると丸められた形で書き込まれる可能性があると想定しています(Excel ではまだ確認していません)。元のファイルを保持するか、列をテキストとしてインポートしてください(#5)
- 接頭辞の `'` は、ファイルを開いたときの数式の実行を防ぎますが、OWASP は、ファイルの保存と再度開く操作の後に Excel が引用符やエスケープ文字を取り除く可能性があると警告しています(#5)
- `customers/redact` が印を付けるのは、アプリが既に保存している注文だけです。`orders_to_redact` にある注文を後で保存すると(たとえば既存の注文の同期で)、顧客フィールドはその時点で Shopify が返す値になります。`app/uninstalled` と `shop/redact` はショップの注文を削除し、`customerRedacted` も一緒に消えます。そのため再インストール後の同期では、Shopify が返す場合、redact 済みの注文の顧客フィールドが保存される可能性があります(#65、#98)
- ショップのオフライントークン(マーチャントがいないときにアプリが使うアクセストークン)の期限が切れていると `app/uninstalled` の配信が失敗し、ショップのデータが削除されません。`authenticate.webhook` は、ルートのコードが実行される前に期限切れのトークンを更新します。開発ストアでの確認では、リフレッシュトークン自体の期限はまだ数か月先のまま、セッションの `expires` を 1 時間前に設定してアプリをアンインストールしました。確認できた 3 回の配信は 500 を返し、`Received APP_UNINSTALLED` はログに出ず、5 分後も `Session` の行は残っていました。同じ日のそれより前のアンインストールでは、セッションの期限は切れておらず、200 を返して行を削除しました。確認できていないのは次の点です: 更新処理が原因であること(アプリはこれについて何もログに出さないので、ライブラリのコードと 2 回のアンインストールの違いから読み取ったものです)、Shopify の残りの再試行の結果、自然に期限切れになったトークンの場合、この状態での `shop/redact` と `customers/redact`(同じコードを通るので、セッションが残っている間は同様に失敗すると想定しています)。本番環境については[行 5](#5-顧客データ)を参照してください(#95)
- 署名付きの `app/uninstalled` の配信は再送できます。署名は本文だけを対象とし、アプリはどの配信を処理したか記録していません。そのため、過去の配信の本文と署名を再インストール後に再送すると、新しいインストールの注文、商品、オフラインセッション(そのトークンを保持する保存済みのセッション)が削除されます。署名されたペイロードのショップのチェック(#94)では防げません。本文が同じショップを指しているからです。下記の #74 で提案している修正でも防げません。`triggeredAt` は署名の対象外である `X-Shopify-Triggered-At` ヘッダーから得るので、送信者が設定できるからです。これはコードから読み取ったもので、再現はしておらず、修正方法も決まっていません。本番環境の設計とその限界は[行 4](#4-重複する-webhook)にあります(#98)
- `shop/redact` は、`app/uninstalled` の取りこぼしと再インストールを区別できません。`app/uninstalled` はショップのセッションを削除するので、ルートは残っているセッションをすべて再インストールとみなし、200 を返して何も削除しません。`app/uninstalled` が一度も成功しなかった場合(たとえば Shopify の再試行期間より長い障害の後)にもセッションは残り、その場合はショップの注文と顧客データが残ります。トークンの期限切れの場合(#95)、`shop/redact` はこのチェックに到達する前に失敗すると想定され、データはやはり残ります。`Session` には 2 つの場合を区別できる作成日時がありません。本番環境については[行 4](#4-重複する-webhook)を参照してください(#97)
- 遅れた `app/uninstalled` の再試行が、再インストールしたショップのデータを削除する場合があります。最初の配信が失敗し、マーチャントが Shopify の再試行期間(4 時間で 8 回の再試行)のうちに再インストールすると、再試行が新しいインストールの注文、商品、オフラインセッションを削除します。その後、マーチャントがアプリを再度開くまで、注文の Webhook は何も保存しません。本番環境での修正(配信の `triggeredAt` をインストール日時と比較する)は[行 4](#4-重複する-webhook)にあります(#74)
- `app/uninstalled` は `myshopify_domain` に依存していますが、これは 1 つの開発ストアの実際の配信でしか確認しておらず、Shopify のドキュメントのサンプルでは null です。正規の配信で null や別の値が届くと、401 を返して `Rejected APP_UNINSTALLED webhook` をログに出します。Shopify は再試行して諦める(4 時間で 8 回の再試行)ので、注文と顧客データ、セッションは残ります。48 時間後の `shop/redact` は、そのセッションを再インストールとみなすので何も削除しません。本番環境については[行 7](#7-デプロイと監視)を参照してください(#94)
- タグ追加のフォームには `method` も `action` もないので、ページのハイドレーション前に送信すると、`/app?tag=...` への単純な GET が送られると想定しています。これにより埋め込みアプリの `shop` と `host` のパラメーターが失われ、認証がリダイレクトまたは失敗する場合があります。タグは書き込まれません。これはコードから読み取ったもので、再現はしていません。本番環境では、ハイドレーションまでコントロールを無効にします(#84、#70)
- `updatedAt` は 1 秒単位で、同じ値の取得は書き込みます。同じ秒の後の変更を含む可能性があるからです。そのため、タグの編集より前の Webhook の取得が編集と同じ秒で、最後に書き込まれると、保存済みのコピーからその編集を消してしまう場合があります。コピーは次に注文が変わるまでそのままで、同期でも修復されません。同期は `updatedAt` が同じ注文を飛ばすからです(#3)

## 本番環境への移行

本番環境で設計がどう変わるかを、[README](../README.ja.md#本番環境への移行) の表の各行について、理由と根拠とともに示します。ここに書いたものはどれも実装していません。根拠は、このリポジトリでの測定と確認、およびプラットフォームと使用中のデータベースのドキュメントにある事実です。

### 1. 応答と処理

- **ボトルネック:** 応答が処理を待ちます。Webhook に応答するのは注文を取得して保存した後で、これに約 0.5 秒かかります
- **本番環境の設計:** 受け付けと処理を分けます。署名を検証し、配信を永続的なキューに入れて応答します。別のプロセスが注文を取得して保存し、失敗したら再試行します
- **理由:** 処理時間や注文の集中によって、応答が期限に間に合うかどうかが左右されなくなります。キューを永続的にする必要があるのは、Shopify が再試行するのは応答がないときとエラーのときだけだからです。アプリが応答した後は、メモリ上にしかない配信はプロセスが止まると失われます
- **根拠:**
  - 1 回の配信にかかる時間は中央値 538 ms、90 パーセンタイル 619 ms です([ADR-0005](adr/0005-process-webhooks-synchronously.md))。Shopify には "a five-second timeout for the entire request" があります([Respond with a 200 OK quickly](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#respond-with-a-200-ok-quickly))
  - 8 秒以内の 39 回の配信は、すべて最初の試行で保存されました([ADR-0005](adr/0005-process-webhooks-synchronously.md)、[PR #81](https://github.com/rukiita/shopify_test/pull/81))
  - 書き込みを直列にしても、集中を吸収できるのは一定の量までです。一度に小さな注文で約 170 件、大きな注文で約 75 件が上限です。これはデータベースの書き込みだけで測定した値で、ルートを通すともっと少ない可能性があります。2 明細の注文では 150 件を同時に書き込むとすべて保存され、200 件では 23 件が失敗しました。250 明細の注文では 60 件を同時に書き込むとすべて保存され、80 件では 2 件が失敗しました([ADR-0005](adr/0005-process-webhooks-synchronously.md)、[PR #81](https://github.com/rukiita/shopify_test/pull/81))
  - "Queuing is a useful pattern for handling bursts of traffic and for ensuring you respond within five seconds"([Queue webhooks to handle traffic bursts](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#queue-webhooks-to-handle-traffic-bursts))
  - "If Shopify receives no response or an error, it retries 8 times over the next 4 hours"([Retries and failures](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#retries-and-failures))

### 2. データベースの書き込み

- **ボトルネック:** 書き込みは 1 つのデータベースファイルへの 1 つの接続で 1 つずつ実行します。このファイルのために、アプリは 1 台のマシンに縛られます
- **本番環境の設計:** 同時書き込みができるデータベースと、状態を持たないアプリにして、複数のインスタンスを実行できるようにします
- **理由:** インスタンスの数に応じて処理能力が増え、1 つの障害でアプリが止まらなくなります
- **根拠:**
  - "SQLite only supports one writer at a time per database file"([Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html))
  - 複数の接続では、同時書き込みが失敗しました。テストデータベースでは、同時に 2 つか 3 つの書き込みは成功し、5 つ以上ではすべての呼び出しが 5 秒以上たって失敗しました。開発ストアでは、30 秒以内の約 30 回の配信によってデータベースが 71 秒間ロックされました。考えられる原因は、別々の接続のトランザクションが互いのロックを待ち、タイムアウトで終了することです([ADR-0005](adr/0005-process-webhooks-synchronously.md)、[#77](https://github.com/rukiita/shopify_test/issues/77))
  - 1 つの接続にすることで、測定した集中ではこの失敗はなくなりましたが、集中している間は他のすべてのクエリが注文の書き込みを待ちます([ADR-0005](adr/0005-process-webhooks-synchronously.md))

### 3. 取りこぼした Webhook

- **ボトルネック:** コピーを最新に保つのは Webhook だけで、取りこぼしの回復は誰かが **Sync orders** を押すことに依存しています
- **本番環境の設計:** 定期的な照合を追加します。前回の実行以降に変更された注文を取得し、取りこぼした Webhook を補います
- **理由:** 配信は保証されず、再試行には終わりがあります
- **根拠:**
  - "Webhook delivery isn't always guaranteed" なので、"use reconciliation jobs to periodically fetch data from Shopify" とされています([Implement reconciliation jobs](https://shopify.dev/docs/apps/build/webhooks#implement-reconciliation-jobs))。同じページは、**Sync orders** のようなボタンも照合の方法として認めています。ここで足りないのは、誰かが押したときにしか動かない点です
  - Shopify の再試行は "retries 8 times over the next 4 hours" です([Retries and failures](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#retries-and-failures))
  - 配信は実際に失敗します。トークンの期限を手動で 1 時間前に設定すると、確認できた 3 回の配信で `app/uninstalled` は 500 を返しました([#95](https://github.com/rukiita/shopify_test/issues/95))

### 4. 重複する Webhook

- **ボトルネック:** 処理した Webhook を記録していません。重複する注文の Webhook は冪等な書き込みと `updatedAt` のチェックで吸収しますが、削除の Webhook を再送すると、再インストールしたショップのデータが削除されます
- **本番環境の設計:** 処理した Webhook を記録して重複を飛ばします。インストール日時(今の `Session` にはありません)を保存し、削除の Webhook と比較します
- **理由:** 同じ Webhook が複数回届くことがあり、削除は元に戻せません
- **限界:** 配信 ID と配信日時はヘッダーで、署名の対象外です。そのため、配信を記録しても再送を完全には防げません。防げるのは Shopify が送る重複です。過去の本文と署名を持つ人は、新しい ID と日時で再送できます
- **根拠:**
  - Shopify は "your app might receive the same webhook more than once, for example after a network timeout or a retry" とし、`X-Shopify-Webhook-Id` を保存して重複を検出する方法を説明しています([Ignoring duplicates](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#ignoring-duplicates))
  - 署名は "generated using your app's client secret and the raw request body" です([HMAC verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#hmac-verification))。`X-Shopify-Webhook-Id` と `X-Shopify-Triggered-At` はヘッダーです([Headers](https://shopify.dev/docs/apps/build/webhooks/delivery-structure#headers))
  - 遅れた再試行は再インストールしたショップのデータを削除する場合があり([#74](https://github.com/rukiita/shopify_test/issues/74))、`shop/redact` は `app/uninstalled` の取りこぼしと再インストールを区別できません([#97](https://github.com/rukiita/shopify_test/issues/97))。再送はコードから読み取ったもので、再現はしていません([#98](https://github.com/rukiita/shopify_test/issues/98))

### 5. 顧客データ

- **ボトルネック:** 顧客データの扱いは開発用のままです。保存時に暗号化しておらず、データのリクエストはログに記録するだけで、削除の Webhook はセッションに依存し、トークンの期限が切れていると失敗します
- **本番環境の設計:** 保存時に暗号化し、保存しているデータを求められた期間内にストアのオーナーに提供し、削除はセッションなしで署名だけで実行できるようにします
- **理由:** これらはプラットフォームの要件で、削除は必ず実行されなければなりません
- **根拠:**
  - "name, address, phone, or email fields" を使うアプリは "meet all of the level 1 and 2 requirements" が必要です。レベル 1 の要件 9 は "Encrypt data at rest and in transit" で、レベル 2 では "Encrypt your data backups" が加わります([Protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data#requirements))
  - "Complete the action within 30 days of receiving the request" とされ、データのリクエストには "that you need to provide to the store owner directly" である顧客データが示されます([Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance))
  - トークンの期限が切れていると、`app/uninstalled` はショップのデータを削除しませんでした。他の 2 つの削除のルートは確認しておらず、原因はライブラリのコードから読み取ったものです([#95](https://github.com/rukiita/shopify_test/issues/95))

### 6. 大きなデータ

- **ボトルネック:** 大きなデータを 1 つのまとまりとして扱っています。明細は 250 件の 1 ページ、CSV は 1 つのリクエスト内でメモリ上に作成、同期は 1 注文ずつです
- **本番環境の設計:** 作業を分けます。明細はページをたどって取得し、CSV はストリーミングするかバックグラウンドで作成して後で渡し、同期はバックグラウンドの一括取得として実行します
- **理由:** 大規模なストアでは、データが失われ、遅くなり、他の処理を止めることになります
- **根拠:**
  - `app/lib/shopify/order-query.ts` の `lineItems(first: 250)`。それを超える明細は保存されません([#1](https://github.com/rukiita/shopify_test/issues/1))
  - CSV と同期は大規模なストアで測定していません。CSV の読み取りは 1 つの接続を共有し、ファイルの作成はアプリのプロセスを占有するので、その間は注文の Webhook が待たされます([#5](https://github.com/rukiita/shopify_test/issues/5))。同期にかかる時間はインポートする注文の数に比例します([#21](https://github.com/rukiita/shopify_test/issues/21))

### 7. デプロイと監視

- **ボトルネック:** アプリは開発者のマシンでしか動かず、障害に気づけません。デプロイ設定、CI、監視がありません
- **本番環境の設計:** ビルド、テスト、デプロイを自動化し、失敗または拒否された Webhook を監視してアラートを出し、シークレットをコードの外に置きます
- **理由:** 気づかれない障害は再試行が終わるまで続き、データが失われます
- **根拠:**
  - 連続して失敗すると "Warning emails are sent to the app's emergency developer email address" とされています。アプリ自体には監視がありません([Retries and failures](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#retries-and-failures))
  - `myshopify_domain` は 1 つの開発ストアでしか確認していません。正規の配信で null や別の値が届くと、拒否されて `Rejected APP_UNINSTALLED webhook` がログに出ます。このログ行にアラートを設定し、より多くのストアでこのフィールドを確認します([#94](https://github.com/rukiita/shopify_test/issues/94))
  - CI は [#115](https://github.com/rukiita/shopify_test/issues/115) で扱っており、まだ完了していません

### 8. 依存関係

- **ボトルネック:** 依存関係はテンプレートのバージョンのままで、本番の依存関係に既知の問題が 6 件あります
- **本番環境の設計:** 依存関係を定期的に更新し、監査を続けます
- **理由:** 現在の問題があるパッケージはリクエストのデータを扱いませんが、問題は蓄積します
- **根拠:** 本番の依存関係の監査は 6 件(high 4 件、moderate 2 件)を報告し、原因は 2 つです([依存関係の監査](#依存関係の監査))。2026-11-04([PR #103](https://github.com/rukiita/shopify_test/pull/103))と 2026-11-06 に再実行し、件数は同じでした。全体の監査の 39 件は 2026-10-31 のもので、再確認していません

## 依存関係の監査

アプリは [`shopify-app-template-react-router`](https://github.com/Shopify/shopify-app-template-react-router) のバージョン **2026.10.09** から作成し、そのテンプレートが固定する依存関係のバージョンを維持しています。

クリーンインストール(`npm ci`、2026-10-31)での `npm audit` は 39 件の問題を報告します(high 26 件、moderate 13 件)。多くは開発時のみのツール(ESLint、GraphQL codegen、Prisma CLI)に由来します。本番の依存関係に限ると(`npm audit --omit=dev`)6 件(high 4 件、moderate 2 件)で、原因は 2 つです。

| パッケージ | 経路 | 問題 | ここでリスクが低い理由 |
|---|---|---|---|
| `deepmerge-ts` | `prisma` → `@prisma/config` | 再帰的なオブジェクトのマージでのスタック枯渇 | Prisma が設定を読み込むときに使われ、リクエストのデータには使われません |
| `minimatch` | `@react-router/fs-routes` | globparts の増幅によるサービス拒否([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)) | ビルド時にルートのファイル名の照合に使われ、リクエストのデータには使われません |

`deepmerge-ts` の修正にはメジャーアップグレード(Prisma 7)が必要で、開発時のみの問題の修正には新しい ESLint / TypeScript ESLint が必要です。これらのアップグレードはテンプレートから離れ、この課題のデータベースの作業を損なうおそれがあるので、先送りにしています。`minimatch` について `npm audit` は修正を報告していません。`@react-router/fs-routes` はバージョン 9 に依存しており、この勧告はバージョン 11.0.1 で修正されています。本番環境では、これらのアップグレードを行い、`npm audit` を再実行して、`minimatch` を再度確認します([行 8](#8-依存関係))。
