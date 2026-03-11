-- Demo account seed (password: demo1234)
INSERT INTO users (id, username, email, password_hash)
VALUES (
  'demo-0000-0000-0000-000000000001',
  'demo',
  'demo@shopdeck.local',
  '$2b$12$9mV5qspWEym8895wI7Oq2.q9b0TdLmauyev/qf592STWJoRIBMFG6'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO user_profiles (user_id)
VALUES ('demo-0000-0000-0000-000000000001')
ON CONFLICT (user_id) DO NOTHING;
