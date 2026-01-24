import { useNavigate } from 'react-router-dom'

type GuestIntroProps = {
  mode: 'image' | 'video'
  onSignIn: () => void
}

const ASSETS = {
  logo: '/media/yaju-logo.png',
  original: '/media/sample-original.webp',
  edit: '/media/sample-edit.png',
  sub: '/media/sample-sub.jpg',
  pair: '/media/sample-pair.png',
  angle: '/media/sample-angle.png',
  video: '/media/sample-kiss.mp4',
}

export function GuestIntro({ mode, onSignIn }: GuestIntroProps) {
  const navigate = useNavigate()
  const modeLabel = mode === 'video' ? '動画生成' : '画像編集'

  return (
    <div className="guest-shell">
      <section className="guest-hero">
        <div className="guest-hero__copy">
          <div className="guest-hero__badge">{modeLabel}</div>
          <img className="guest-logo" src={ASSETS.logo} alt="YAJU AI" />
          <p className="guest-eyebrow">YAJU AI</p>
          <h1>あなたの理想を現実化する。</h1>
          <p className="guest-lede">
            世界最先端の生成速度で、画像から新たな画像・動画・アングル変更まで一気通貫。
            日本語プロンプト対応、アニメも実写も1分で生成可能です。
          </p>
          <div className="guest-cta">
            <button type="button" className="primary-button" onClick={onSignIn}>
              新規登録（無料）
            </button>
            <button type="button" className="ghost-button" onClick={onSignIn}>
              ログイン
            </button>
            <button type="button" className="ghost-button" onClick={() => navigate('/purchase')}>
              チケット購入
            </button>
          </div>
          <div className="guest-badges">
            <span>新規登録は10秒で完了</span>
            <span>初回3枚チケット付与</span>
            <span>画像1枚 / 動画2枚</span>
          </div>
        </div>
        <div className="guest-hero__visual">
          <div className="guest-stat">
            <strong>リリース2週間で3000ユーザー突破</strong>
            <span>日本語UIでスピード体験</span>
          </div>
          <img className="guest-hero__image" src={ASSETS.pair} alt="生成例: 仲良く肩組み" />
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section__header">
          <h2>できること</h2>
          <p>最短ステップで、あなたのアイデアを形に。</p>
        </div>
        <div className="guest-feature-grid">
          <article className="guest-feature">
            <h3>画像から新たな画像</h3>
            <p>プロンプトだけで衣装や雰囲気、構図を瞬時に変更。</p>
          </article>
          <article className="guest-feature">
            <h3>画像から動画生成</h3>
            <p>静止画を動画へ。SNS用の短尺素材も1分で完成。</p>
          </article>
          <article className="guest-feature">
            <h3>アングル変更</h3>
            <p>45度など視点を切り替えて多彩なバリエーションを作成。</p>
          </article>
          <article className="guest-feature">
            <h3>日本語プロンプト対応</h3>
            <p>実写もアニメもOK。直感的な指示で高精度生成。</p>
          </article>
        </div>
      </section>

      <section className="guest-section">
        <div className="guest-section__header">
          <h2>作例</h2>
          <p>画像編集・合成・アングル変更・動画生成の実例。</p>
        </div>
        <div className="guest-card-grid">
          <article className="guest-card">
            <h3>画像編集（タンクトップ＆ジーンズ）</h3>
            <div className="guest-compare">
              <figure>
                <img src={ASSETS.original} alt="入力画像" />
                <figcaption>入力</figcaption>
              </figure>
              <figure>
                <img src={ASSETS.edit} alt="編集後の画像" />
                <figcaption>生成結果</figcaption>
              </figure>
            </div>
          </article>
          <article className="guest-card">
            <h3>サブ画像合成（肩組み）</h3>
            <div className="guest-trio">
              <figure>
                <img src={ASSETS.edit} alt="メイン画像" />
                <figcaption>メイン</figcaption>
              </figure>
              <figure>
                <img src={ASSETS.sub} alt="サブ画像" />
                <figcaption>サブ</figcaption>
              </figure>
              <figure className="guest-result">
                <img src={ASSETS.pair} alt="合成結果" />
                <figcaption>生成結果</figcaption>
              </figure>
            </div>
          </article>
          <article className="guest-card">
            <h3>アングル変更（45度）</h3>
            <div className="guest-single">
              <img src={ASSETS.angle} alt="45度アングルの生成結果" />
            </div>
          </article>
          <article className="guest-card">
            <h3>画像から動画（約1分）</h3>
            <div className="guest-single">
              <video controls playsInline preload="metadata" src={ASSETS.video} />
            </div>
          </article>
        </div>
      </section>

      <section className="guest-section guest-terms">
        <div className="guest-section__header">
          <h2>利用上の注意</h2>
          <p>安全に使うためのルールをご確認ください。</p>
        </div>
        <ul>
          <li>実在する人物の性的な画像・動画の生成は禁止です。</li>
          <li>第三者の権利や公序良俗に反する生成は行わないでください。</li>
          <li>生成物の利用に関する責任はユーザーに帰属します。</li>
        </ul>
      </section>
    </div>
  )
}
