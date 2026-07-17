-- Nuova regione per quest estreme
INSERT INTO gandalf.regions (name, description) VALUES
    ('Alpi', 'Le montagne più alte d''Europa: ghiacciai, pareti verticali e aria sottile')
ON CONFLICT DO NOTHING;

-- Scalatore Puro: 20 km, 5000 m D+
INSERT INTO gandalf.quests (title, region_id, type, difficulty, xp_reward, distance, elevation, coords, description, npc_dialogue)
SELECT 'Scalatore Puro', r.id, 'trekking', 5, 1500, 20.0, 5000,
    '[
        [45.8550,7.8620],[45.8600,7.8700],[45.8680,7.8780],[45.8750,7.8850],
        [45.8820,7.8920],[45.8900,7.8980],[45.8970,7.9050],[45.9050,7.9100],
        [45.9120,7.9150],[45.9200,7.9180],[45.9270,7.9200],[45.9350,7.9220],
        [45.9420,7.9180],[45.9480,7.9120],[45.9400,7.9020],[45.9320,7.8950],
        [45.9250,7.8880],[45.9180,7.8800],[45.9100,7.8720],[45.9020,7.8650]
    ]'::jsonb,
    'Sfida estrema: 20 km con 5000 m di dislivello positivo attraverso ghiacciai, creste e pareti verticali del Monte Rosa. Solo i veri alpinisti sopravvivono a questa prova.',
    '"Pochi hanno accettato la sfida dello Scalatore Puro. Ancora meno sono tornati indietro. Le gambe ti bruceranno, i polmoni ti imploreranno pietà, ma se arriverai in cima, il tuo nome sarà inciso nella pietra. — Lo Stregone della Montagna"'
FROM gandalf.regions r WHERE r.name = 'Alpi'
ON CONFLICT DO NOTHING;
