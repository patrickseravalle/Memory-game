const express = require('express');
const path = require('path');
const { Server } = require('ws');

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});

const wsServer = new Server({ server });

let players = [];
const newGameState = initializeGame();
newGameState.scores = {}; // Reset dei punteggi

players.forEach(player => {
  newGameState.scores[player] = 0; // Assicura che i giocatori abbiano il punteggio azzerato
});

gameState = newGameState;
broadcast({ type: 'gameRestarted', gameState });

function initializeGame() {
  players = []
  return {
    cards: shuffle([
      'img1', 'img2', 'img3', 'img4',
      'img1', 'img2', 'img3', 'img4',
      'img5', 'img6', 'img7', 'img8',
      'img5', 'img6', 'img7', 'img8'
    ]),
    flippedCards: [],
    matchedCards: [],
    scores: {},
    currentTurn: null
  };
}

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

wsServer.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'join') {
      handlePlayerJoin(ws, data.name);
    } else if (data.type === 'flipCard') {
      handleCardFlip(data.name, data.index);
    } else if (data.type === 'restart') {
      gameState = initializeGame();
      broadcast({ type: 'gameRestarted', gameState });
    }
  });

  ws.on('close', () => {
    console.log(`Un giocatore si è disconnesso.`);
  });
});

function handlePlayerJoin(ws, playerName) {
  if (!players.includes(playerName)) {
    players.push(playerName);
    gameState.scores[playerName] = 0;
  }

  if (!gameState.currentTurn) {
    gameState.currentTurn = players[0]; // Il primo giocatore che entra inizia la partita
  }

  console.log(`Giocatore connesso: ${playerName}`);
  ws.send(JSON.stringify({ type: 'gameState', gameState }));
  broadcast({ type: 'playerJoined', name: playerName, gameState });
}

function handleCardFlip(playerName, index) {
  if (playerName !== gameState.currentTurn) return; // Solo il giocatore di turno può giocare
  if (gameState.flippedCards.length >= 2) return;

  gameState.flippedCards.push({ index, value: gameState.cards[index], player: playerName });

  if (gameState.flippedCards.length === 2) {
    setTimeout(() => checkMatch(playerName), 1000);
  }

  broadcast({ type: 'updateGame', gameState });
}

function checkMatch(playerName) {
  const [first, second] = gameState.flippedCards;

  if (first.value === second.value) {
    gameState.matchedCards.push(first.index, second.index);
    gameState.scores[playerName] += 1;
    broadcast({ type: 'updateGame', gameState });
  } else {
    changeTurn();
  }

  gameState.flippedCards = [];

  if (gameState.matchedCards.length === gameState.cards.length) {
    const winner = Object.entries(gameState.scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    broadcast({ type: 'gameOver', winner, scores: gameState.scores });
  } else {
    broadcast({ type: 'updateGame', gameState });
  }
}

function changeTurn() {
  const currentIndex = players.indexOf(gameState.currentTurn);
  gameState.currentTurn = players[(currentIndex + 1) % players.length];
}

function broadcast(data) {
  const message = JSON.stringify(data);
  wsServer.clients.forEach(client => client.send(message));
}
