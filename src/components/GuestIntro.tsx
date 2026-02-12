type GuestIntroProps = {
  mode: 'image' | 'video'
  onSignIn: () => void
}

const ASSETS = {
  logo: '/media/animone-logo.webp',
  headlineArt: '/media/fox-ai-banner-2.png',
  howToSource: '/media/howto-source.jpg',
  howToResult: '/media/howto-result.mp4',
}

export function GuestIntro({ mode: _mode, onSignIn }: GuestIntroProps) {
  return (
    <div className="guest-shell guest-shell--media">
      <section className="guest-headline">
        <p className="guest-headline__overlay">AIですべての画像を動画に</p>
        <img className="guest-headline__art" src={ASSETS.headlineArt} alt="FOX AI" />
        <div className="guest-headline__quick">
          <span>画像から画像</span>
          <span>画像から動画</span>
          <span>登録無料</span>
        </div>
      </section>

      <section className="guest-minimal">
        <p>今だけユーザー登録で3回無料生成</p>
        <div className="guest-promo">
          <span>世界最先端のAIエンジン搭載</span>
          <span>ユーザー満足度97%</span>
        </div>
        <div className="guest-cta guest-cta--center">
          <button type="button" className="primary-button primary-button--shimmer" onClick={onSignIn}>
            登録 / ログイン
          </button>
        </div>
      </section>

      <section className="guest-howto">
        <div className="guest-howto__header">
          <h2>使い方</h2>
          <p>画像1枚とプロンプトだけで、すぐに動画化。</p>
        </div>
        <div className="guest-howto__flow">
          <div className="guest-howto__card">
            <p className="guest-howto__label">元画像</p>
            <img src={ASSETS.howToSource} alt="元画像サンプル" loading="lazy" />
          </div>
          <div className="guest-howto__card guest-howto__card--prompt">
            <p className="guest-howto__label">入力プロンプト</p>
            <p className="guest-howto__prompt">女性が笑顔で手を振る</p>
          </div>
          <div className="guest-howto__card">
            <p className="guest-howto__label">生成結果</p>
            <video src={ASSETS.howToResult} autoPlay loop muted playsInline preload="metadata" />
          </div>
        </div>
      </section>

      <section className="guest-section guest-faq">
        <div className="guest-section__header">
          <h2>FOX AIについて</h2>
        </div>
        <div className="guest-faq__list">
          <div className="guest-faq__item">
            <p className="guest-faq__q">Q. FOX AIとは？</p>
            <p className="guest-faq__a">A. テキストや画像から短い動画を生成できるプラットフォームです。</p>
          </div>
          <div className="guest-faq__item">
            <p className="guest-faq__q">Q. 必要なトークン数は？</p>
            <p className="guest-faq__a">
              A. 動画1回の生成に1トークンを消費します。無料ユーザー登録で3トークン付与、さらに12時間ごとに1トークンをプレゼントします。
            </p>
          </div>
          <div className="guest-faq__item">
            <p className="guest-faq__q">Q. T2V / I2V とは？</p>
            <p className="guest-faq__a">
              A. T2Vはテキストから動画を生成、I2Vは画像をベースに動画化するモードです。
            </p>
          </div>
          <div className="guest-faq__item">
            <p className="guest-faq__q">Q. プロンプトの対応言語は？</p>
            <p className="guest-faq__a">A. 日本語・英語・中国語に加えて、全20言語以上に対応しています。</p>
          </div>
          <div className="guest-faq__item">
            <p className="guest-faq__q">Q. 途中で顔が変わることがある？</p>
            <p className="guest-faq__a">
              A. 被写体の属性を具体的に指定すると安定しやすいです。（例: 「アジア人の女性」など）
            </p>
          </div>
        </div>
      </section>

      <section className="guest-section guest-terms">
        <div className="guest-section__header">
          <h2>利用ガイドライン</h2>
          <p>安全に使うためのルールです。</p>
        </div>
                
        
        <ul>
          <li>法令・条例に違反する目的での利用は禁止です。</li>
          <li>暴力的・差別的・憎悪的・嫌がらせ目的の生成は禁止です。</li>
          <li>未成年、または未成年に見える人物の性的表現は禁止です。</li>
          <li>実在人物の性的表現・搾取的表現の生成は禁止です。</li>
          <li>なりすまし、虚偽の所属・肩書の捏造は禁止です。</li>
          <li>個人情報（氏名、住所、電話、メール、ID等）の推定・特定・開示は禁止です。</li>
          <li>著作権・商標権・肖像権など第三者の権利侵害は禁止です。</li>
          <li>詐欺、違法取引、武器・薬物等の助長は禁止です。</li>
          <li>マルウェア、フィッシング、スパム等の不正行為を助長する生成は禁止です。</li>
          <li>医療・法務・金融など専門助言を装う生成は禁止です。</li>
          <li>安全機能の回避、制限の迂回、負荷攻撃は禁止です。</li>
          <li>生成物の利用・公開はユーザーの責任で行ってください。</li>
          <li>生成結果の正確性や品質は保証されません。</li>
          <li>当社は必要に応じて利用制限・停止等の対応を行う場合があります。</li>
        </ul>
      </section>

      <section className="guest-section guest-tokusho">
        <div className="guest-section__header">
          <h2>特定商取引法に基づく表記</h2>
          <p>サービス提供に関する重要事項を記載しています。</p>
        </div>
        <ul>
          <li>販売事業者名：FOX AI</li>
          <li>運営責任者：FOX AI運営責任者</li>
          <li>販売価格：各プランページに表示</li>
          <li>商品代金以外の必要料金：通信料等はお客様の負担となります</li>
          <li>支払方法：クレジットカード（Linkを含む）</li>
          <li>支払時期：決済時に即時処理されます</li>
          <li>提供時期：決済完了後すぐに利用可能</li>
          <li>動作環境：最新のChrome / Edge / Safari 推奨</li>
        </ul>
      </section>
    </div>
  )
}
