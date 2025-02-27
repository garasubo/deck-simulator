import { useState } from 'react';
import './Home.css';

interface Card {
  id: string;
  name: string;
}

interface Combination {
  id: string;
  cards: string[]; // Array of card IDs
  name: string;
}

const Home = () => {
  const [cards, setCards] = useState<Card[]>([]);
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [deckSize, setDeckSize] = useState<number>(40);
  const [drawSize, setDrawSize] = useState<number>(5);
  const [simulationResults, setSimulationResults] = useState<{
    singleCardProbabilities: { [key: string]: number };
    combinationProbabilities: { [key: string]: number };
    anyComboProb?: number;
  } | null>(null);
  const [newCard, setNewCard] = useState<{ name: string; quantity: number }>({ name: '', quantity: 1 });
  const [newCombination, setNewCombination] = useState<{
    name: string;
    selectedCards: string[];
  }>({ name: '', selectedCards: [] });

  // Add new cards to the deck
  const handleAddCard = () => {
    if (newCard.name.trim() === '' || newCard.quantity <= 0) return;
    
    const newCards: Card[] = [];
    for (let i = 0; i < newCard.quantity; i++) {
      newCards.push({
        id: `card-${Date.now()}-${i}`,
        name: newCard.name.trim()
      });
    }
    
    setCards([...cards, ...newCards]);
    setNewCard({ name: '', quantity: 1 });
  };

  // Add a new combination
  const handleAddCombination = () => {
    if (newCombination.name.trim() === '' || newCombination.selectedCards.length < 1) return;
    
    const newCombinationObj: Combination = {
      id: `combo-${Date.now()}`,
      name: newCombination.name.trim(),
      cards: [...newCombination.selectedCards]
    };
    
    setCombinations([...combinations, newCombinationObj]);
    setNewCombination({ name: '', selectedCards: [] });
  };

  // Run simulation
  const runSimulation = () => {
    // Group cards by name and count occurrences
    const cardCounts: { [name: string]: { count: number; id: string } } = {};
    cards.forEach(card => {
      if (!cardCounts[card.name]) {
        cardCounts[card.name] = { count: 1, id: card.id };
      } else {
        cardCounts[card.name].count++;
      }
    });
    
    const singleCardProbabilities: { [key: string]: number } = {};
    const combinationProbabilities: { [key: string]: number } = {};
    let anyComboProb = 0;
    
    // Calculate single card probabilities
    Object.entries(cardCounts).forEach(([name, { count }]) => {
      // Probability of drawing at least one of this card
      const prob = 1 - calculateProbabilityOfNotDrawing(count, deckSize, drawSize);
      singleCardProbabilities[name] = prob;
    });
    
    // Helper function to create a deck for simulation
    const createDeck = () => {
      const deck: string[] = [];
      Object.entries(cardCounts).forEach(([name, { count }]) => {
        for (let i = 0; i < count; i++) {
          deck.push(name);
        }
      });
      
      // Pad the deck to the specified size if needed
      while (deck.length < deckSize) {
        deck.push('FILLER_CARD');
      }
      
      return deck;
    };
    
    // Helper function to get required cards for a combination
    const getRequiredCards = (combo: Combination) => {
      const requiredCards = new Set<string>();
      combo.cards.forEach(cardId => {
        const card = cards.find(c => c.id === cardId);
        if (card) {
          requiredCards.add(card.name);
        }
      });
      return requiredCards;
    };
    
    // Helper function to check if a combination is complete in drawn cards
    const isComboComplete = (combo: Combination, drawnCards: string[]) => {
      const requiredCards = getRequiredCards(combo);
      return Array.from(requiredCards).every(cardName => 
        drawnCards.includes(cardName)
      );
    };
    
    // Run Monte Carlo simulations
    const NUM_SIMULATIONS = 10000;
    const deck = createDeck();
    const comboProbabilities: number[] = [];
    
    // Calculate individual combination probabilities using exact hypergeometric distribution
    combinations.forEach(combo => {
      // Get unique card names in this combination
      const requiredCards = getRequiredCards(combo);
      
      // Calculate the probability of drawing all required cards
      // We need to calculate the probability of drawing at least one of each required card
      let combinationProbability = 1.0;
      
      Array.from(requiredCards).forEach(cardName => {
        const count = cardCounts[cardName]?.count || 0;
        if (count > 0) {
          // Probability of drawing at least one of this card
          const cardProb = 1 - calculateProbabilityOfNotDrawing(count, deckSize, drawSize);
          combinationProbability *= cardProb;
        } else {
          // If any required card is not in the deck, probability is 0
          combinationProbability = 0;
        }
      });
      
      combinationProbabilities[combo.id] = combinationProbability;
      comboProbabilities.push(combinationProbability);
    });
    
    // Calculate probability of drawing at least one of any combination using the principle of inclusion-exclusion
    if (combinations.length > 0) {
      // Function to calculate the probability of drawing a specific set of combinations
      const calculateCombinationSetProbability = (comboIndices: number[]): number => {
        if (comboIndices.length === 0) return 0;
        
        // Get all unique cards required by this set of combinations
        const requiredCardNames = new Set<string>();
        comboIndices.forEach(index => {
          const combo = combinations[index];
          combo.cards.forEach(cardId => {
            const card = cards.find(c => c.id === cardId);
            if (card) requiredCardNames.add(card.name);
          });
        });
        
        // Calculate the probability of drawing all required cards
        // For each required card, calculate the probability of drawing at least one
        let probability = 1.0;
        requiredCardNames.forEach(cardName => {
          const count = cardCounts[cardName]?.count || 0;
          if (count > 0) {
            // Probability of drawing at least one of this card
            const cardProb = 1 - calculateProbabilityOfNotDrawing(count, deckSize, drawSize);
            probability *= cardProb;
          } else {
            // If any required card is not in the deck, probability is 0
            probability = 0;
          }
        });
        
        return probability;
      };
      
      // Apply the principle of inclusion-exclusion
      let result = 0;
      
      // Generate all possible subsets of combinations (power set)
      const generateSubsets = (n: number): number[][] => {
        const subsets: number[][] = [];
        const total = Math.pow(2, n);
        
        for (let i = 1; i < total; i++) {
          const subset: number[] = [];
          for (let j = 0; j < n; j++) {
            if ((i & (1 << j)) !== 0) {
              subset.push(j);
            }
          }
          subsets.push(subset);
        }
        
        return subsets;
      };
      
      const subsets = generateSubsets(combinations.length);
      
      // Apply inclusion-exclusion principle
      subsets.forEach(subset => {
        const sign = subset.length % 2 === 1 ? 1 : -1;
        const probability = calculateCombinationSetProbability(subset);
        result += sign * probability;
      });
      
      anyComboProb = Math.max(0, Math.min(1, result)); // Ensure result is between 0 and 1
    }
    
    setSimulationResults({
      singleCardProbabilities,
      combinationProbabilities,
      anyComboProb
    });
  };

  // Binomial coefficient (n choose k)
  const binomialCoefficient = (n: number, k: number): number => {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    
    // Calculate using factorials, but avoid overflow by cancelling out terms
    let result = 1;
    for (let i = 1; i <= k; i++) {
      result *= (n - (k - i));
      result /= i;
    }
    return result;
  };

  // Hypergeometric probability: P(X = k) where X is the number of successes
  const hypergeometricProbability = (
    populationSize: number,    // N (deck size)
    successesInPopulation: number,  // K (number of target cards in deck)
    sampleSize: number,        // n (draw size)
    successesInSample: number  // k (number of target cards in hand)
  ): number => {
    const successesCoeff = binomialCoefficient(successesInPopulation, successesInSample);
    const failuresCoeff = binomialCoefficient(
      populationSize - successesInPopulation, 
      sampleSize - successesInSample
    );
    const totalCoeff = binomialCoefficient(populationSize, sampleSize);
    
    return (successesCoeff * failuresCoeff) / totalCoeff;
  };

  // Calculate probability of NOT drawing any of a specific card
  const calculateProbabilityOfNotDrawing = (count: number, deckSize: number, drawSize: number): number => {
    // Probability of drawing 0 of the target card
    return hypergeometricProbability(deckSize, count, drawSize, 0);
  };

  return (
    <div className="home-container">
      <h1>Deck Simulator</h1>
      
      <div className="simulator-section">
        <div className="deck-settings">
          <h2>Deck Settings</h2>
          <div className="form-group">
            <label htmlFor="deckSize">Deck Size:</label>
            <input
              type="number"
              id="deckSize"
              value={deckSize}
              onChange={(e) => setDeckSize(parseInt(e.target.value) || 40)}
              min="1"
            />
          </div>
          <div className="form-group">
            <label htmlFor="drawSize">Draw Size:</label>
            <input
              type="number"
              id="drawSize"
              value={drawSize}
              onChange={(e) => setDrawSize(parseInt(e.target.value) || 5)}
              min="1"
              max={deckSize}
            />
          </div>
        </div>
        
        <div className="card-management">
          <h2>Add Cards</h2>
          <div className="form-group">
            <input
              type="text"
              placeholder="Card Name"
              value={newCard.name}
              onChange={(e) => setNewCard({ ...newCard, name: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label htmlFor="cardQuantity">Quantity:</label>
            <input
              type="number"
              id="cardQuantity"
              value={newCard.quantity}
              onChange={(e) => setNewCard({ ...newCard, quantity: parseInt(e.target.value) || 1 })}
              min="1"
            />
          </div>
          <button onClick={handleAddCard}>Add Card</button>
          
          <h3>Cards in Deck</h3>
          <ul className="card-list">
            {(() => {
              // Group cards by name and count
              const cardCounts: { [name: string]: number } = {};
              cards.forEach(card => {
                cardCounts[card.name] = (cardCounts[card.name] || 0) + 1;
              });
              
              // Display each card type with its count
              return Object.entries(cardCounts).map(([name, count]) => (
                <li key={name} className="card-item">
                  {name} × {count}
                </li>
              ));
            })()}
          </ul>
        </div>
        
        <div className="combination-management">
          <h2>Add Combinations</h2>
          <div className="form-group">
            <input
              type="text"
              placeholder="Combination Name"
              value={newCombination.name}
              onChange={(e) => setNewCombination({ ...newCombination, name: e.target.value })}
            />
          </div>
          
          <h3>Select Cards for Combination</h3>
          <ul className="card-selection-list">
            {(() => {
              // Group cards by name and get the first ID for each
              const uniqueCards: { [name: string]: string } = {};
              cards.forEach(card => {
                if (!uniqueCards[card.name]) {
                  uniqueCards[card.name] = card.id;
                }
              });
              
              // Display one checkbox per unique card name
              return Object.entries(uniqueCards).map(([name, id]) => {
                // Check if any card with this name is selected
                const isSelected = cards.some(card => 
                  card.name === name && newCombination.selectedCards.includes(card.id)
                );
                
                // Toggle selection for all cards with this name
                const handleToggle = () => {
                  const selectedCards = [...newCombination.selectedCards];
                  
                  if (isSelected) {
                    // Remove all cards with this name
                    const filteredCards = selectedCards.filter(cardId => {
                      const card = cards.find(c => c.id === cardId);
                      return card && card.name !== name;
                    });
                    setNewCombination({ ...newCombination, selectedCards: filteredCards });
                  } else {
                    // Add the first card with this name
                    selectedCards.push(id);
                    setNewCombination({ ...newCombination, selectedCards: selectedCards });
                  }
                };
                
                return (
                  <li key={name} className="card-selection-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={handleToggle}
                      />
                      {name}
                    </label>
                  </li>
                );
              });
            })()}
          </ul>
          
          <button 
            onClick={handleAddCombination}
            disabled={newCombination.selectedCards.length < 1 || newCombination.name.trim() === ''}
          >
            Add Combination
          </button>
          
          <h3>Defined Combinations</h3>
          <ul className="combination-list">
            {combinations.map(combo => {
              // Get unique card names in this combination
              const uniqueCardNames = new Set<string>();
              combo.cards.forEach(cardId => {
                const card = cards.find(c => c.id === cardId);
                if (card) {
                  uniqueCardNames.add(card.name);
                }
              });
              
              return (
                <li key={combo.id} className="combination-item">
                  <strong>{combo.name}:</strong> {Array.from(uniqueCardNames).join(' + ')}
                </li>
              );
            })}
          </ul>
        </div>
        
        <div className="simulation-controls">
          <button 
            className="run-simulation-button"
            onClick={runSimulation}
            disabled={cards.length === 0}
          >
            Run Simulation
          </button>
        </div>
        
        {simulationResults && (
          <div className="simulation-results">
            <h2>Simulation Results</h2>
            
            <h3>Single Card Probabilities</h3>
            <ul className="results-list">
              {Object.entries(simulationResults.singleCardProbabilities).map(([cardName, probability]) => (
                <li key={cardName} className="result-item">
                  <span>{cardName}:</span> {(probability * 100).toFixed(2)}%
                </li>
              ))}
            </ul>
            
            <h3>Combination Probabilities</h3>
            <ul className="results-list">
              {Object.entries(simulationResults.combinationProbabilities).map(([comboId, probability]) => {
                const combo = combinations.find(c => c.id === comboId);
                return combo ? (
                  <li key={comboId} className="result-item">
                    <span>{combo.name}:</span> {(probability * 100).toFixed(2)}%
                  </li>
                ) : null;
              })}
            </ul>
            
            {simulationResults.anyComboProb !== undefined && combinations.length > 0 && (
              <div className="any-combo-probability">
                <h3>Probability of Any Combination</h3>
                <p className="result-item highlight">
                  <span>Probability of drawing at least one combination:</span> 
                  {(simulationResults.anyComboProb * 100).toFixed(2)}%
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
