export function resolveAnkiNames(decks) {
    return Array.isArray(decks) && decks.includes('Pot')
        ? { deckName: 'Pot', modelName: 'Pot Card 2' }
        : { deckName: 'Aries', modelName: 'Aries Card' };
}
