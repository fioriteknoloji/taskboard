# Ekip Panosu — Kurulum & Deploy Rehberi

Gerçek zamanlı, çok kullanıcılı kanban panosu.
**Stack:** Next.js 14 + Supabase (Postgres + Realtime) + Vercel

---

## Adım 1 — Supabase Kurulumu (5 dk)

1. https://supabase.com adresine git → **Start your project** → GitHub ile giriş yap
2. **New project** → isim ver (örn. `ekip-pano`) → şifre belirle → bölge: **EU West** → Create
3. Proje açılınca sol menüden **SQL Editor**'e gir
4. `supabase_schema.sql` dosyasının içeriğini yapıştır → **Run** butonuna bas
5. Sol menüde **Settings > API** sekmesine git:
   - **Project URL** → kopyala
   - **anon / public** key → kopyala
6. Projenin kök dizinine `.env.local` adında bir dosya oluştur:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## Adım 2 — Lokal test (2 dk)

```bash
npm install
npm run dev
```

http://localhost:3000 aç, kartların geldiğini gör. Başka bir sekmede aç, bir kartı sürükle — diğer sekmede anında görünmeli.

---

## Adım 3 — GitHub'a yükle (2 dk)

```bash
git init
git add .
git commit -m "ekip panosu ilk versiyon"
```

GitHub'da yeni bir repo oluştur (private olabilir), sonra:

```bash
git remote add origin https://github.com/KULLANICI_ADI/ekip-pano.git
git branch -M main
git push -u origin main
```

---

## Adım 4 — Vercel Deploy (3 dk)

1. https://vercel.com → **New Project** → GitHub repoyu seç → Import
2. **Environment Variables** bölümünde iki değişkeni gir:
   - `NEXT_PUBLIC_SUPABASE_URL` → Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase anon key
3. **Deploy** butonuna bas → 1-2 dakika bekle
4. Verilen link'i (`https://ekip-pano.vercel.app` gibi) ekibinle paylaş

---

## Takım üyelerini eklemek

`app/page.js` dosyasında en üstteki `TEAM` dizisini düzenle:

```js
const TEAM = [
  { initials: 'AK', name: 'Ahmet K.' },
  // yeni üye ekle:
  { initials: 'YY', name: 'Yeni Üye' },
]
```

Dosyayı kaydet → git push → Vercel otomatik deploy eder.

---

## Maliyet

| Servis | Ücretsiz limit | Notlar |
|--------|----------------|--------|
| Supabase | 500MB DB, 2GB bandwidth/ay | 10 kişilik ekip için yıllarca yeter |
| Vercel | 100GB bandwidth/ay | Ücretsiz plan yeterli |

**Toplam maliyet: 0₺**
