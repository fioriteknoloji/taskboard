-- Ekip Panosu Supabase Veritabanı Şeması

-- 1. Tabloların Oluşturulması

-- Profiller Tablosu
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  initials text,
  role text DEFAULT 'member',
  PRIMARY KEY (id)
);

-- Görevler Tablosu
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'mid',
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  tags text[] DEFAULT '{}',
  notes jsonb DEFAULT '[]'::jsonb,
  due_date date,
  start_date date,
  recurrence text,
  recurrence_end date,
  parent_recurring_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Alt Görevler (Subtasks) Tablosu
CREATE TABLE public.subtasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean DEFAULT false,
  PRIMARY KEY (id)
);

-- Görev Bağımlılıkları Tablosu
CREATE TABLE public.task_dependencies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (id)
);

-- Aktivite Kayıtları Tablosu
CREATE TABLE public.activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_title text,
  action text,
  detail text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Bildirimler Tablosu
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  task_title text,
  message text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- 2. Auth Trigger (Kullanıcı Kayıt Olduğunda Profile Eklemek İçin)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, initials, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'initials',
    new.raw_user_meta_data->>'role'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı auth.users tablosuna bağlama
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Güvenlik Politikaları (Row Level Security - RLS)
-- Ekip içi bir uygulama olduğu için okuma/yazma işlemleri oturum açmış herkese açık bırakılabilir (İsteğe bağlı kısıtlanabilir).

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Oturum açmış kullanıcılar her şeyi yapabilir (Basit Kurulum)
CREATE POLICY "Enable ALL for authenticated users on profiles" ON public.profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable ALL for authenticated users on tasks" ON public.tasks FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable ALL for authenticated users on subtasks" ON public.subtasks FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable ALL for authenticated users on task_dependencies" ON public.task_dependencies FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable ALL for authenticated users on activity" ON public.activity FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable ALL for authenticated users on notifications" ON public.notifications FOR ALL TO authenticated USING (true);

-- 4. Realtime (Gerçek Zamanlı) Aktifleştirme
-- İstemci tarafında Supabase subscription'larının çalışması için tabloları yayına açıyoruz
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.activity;
alter publication supabase_realtime add table public.subtasks;
alter publication supabase_realtime add table public.notifications;
