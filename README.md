# Iron Fit

منصة لإدارة المدرب لمشتركيه: المشتركين، البرامج التدريبية، خطط التغذية، تسجيل التقدم، الرسائل، وحاسبة السعرات.
مبنية بـ Next.js 16 و PostgreSQL.

## التشغيل محليًا

المتطلبات: Node.js 20.9 أو أحدث، و PostgreSQL 14 أو أحدث.

```bash
cp .env.example .env.local      # عدّل القيم: DATABASE_URL و SECURITY_PEPPER وكلمات المرور
npm install
npm run db:init                 # ينشئ الجداول
npm run db:seed                 # ينشئ حساب المدرب وحساب مشترك تجريبي
npm run dev                     # http://localhost:3000
```

ملاحظات:
- مع قاعدة بيانات محلية بدون SSL ضع `DATABASE_SSL=disable`.
- ولّد `SECURITY_PEPPER` بالأمر `openssl rand -hex 32`.
- `npm run db:seed` و `db:init` يقرآن المتغيرات من البيئة، لذلك صدّرها أولًا: `set -a; . ./.env.local; set +a`.

## الإنتاج

```bash
npm run build
npm start
```

اضبط `NEXT_PUBLIC_APP_URL` على رابط الموقع الفعلي.

## الحسابات

- **المدرب**: يُنشأ بالأمر `db:seed` من `SEED_COACH_EMAIL` و `SEED_COACH_PASSWORD`.
- **المشتركون**: ينشئ المدرب حساب الدخول لكل مشترك من صفحة "المشتركين" (بريد + كلمة مرور، اختياري).
  حذف المشترك يحذف حساب دخوله أيضًا.

## الفحوصات

```bash
npm run typecheck
npm run lint
npm run security:check
```
