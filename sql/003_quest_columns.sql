-- Aggiunge colonne description e npc_dialogue alla tabella quests
ALTER TABLE gandalf.quests
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS npc_dialogue text;

UPDATE gandalf.quests SET
    description = 'Un anello di acque scure circonda la foresta incantata. I pescatori parlano di luci che danzano sulla superficie nelle notti di luna piena.',
    npc_dialogue = '"Ah, finalmente un''avventuriero! Il Lago Nero è irrequeto da settimane. Portami prove del tuo passaggio e ti ricompenserò!"'
WHERE title = 'Anello del Lago Nero' AND description IS NULL;

UPDATE gandalf.quests SET
    description = 'Un antico sentiero usato dai contrabbandieri tra picchi aguzzi e passaggi stretti.',
    npc_dialogue = '"Sssst! Non parlarne troppo forte. Quel sentiero nasconde più segreti di quanti tu possa immaginare. Arriva in cima e portami una prova. E prega di non incontrare ciò che ci abita."'
WHERE title = 'Sentiero dei Contrabbandieri' AND description IS NULL;

UPDATE gandalf.quests SET
    description = 'Una discesa mozzafiato attraverso i boschi. Il vento fischia tra i rami mentre la montagna precipita verso la valle.',
    npc_dialogue = '"Ehi, tu! Scommetto che non hai il coraggio di fare la Discesa Fulmine in meno di un''ora. Se ce la fai, ti insegno il trucco per saltare il ruscello!"'
WHERE title = 'Discesa Fulmine' AND description IS NULL;
