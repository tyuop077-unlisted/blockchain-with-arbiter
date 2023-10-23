import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function getUserInput(question: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

class Block {
  previousHash: string;
  timestamp: Number;
  data: string;
  hash: string;

  constructor(previousHash: string, timestamp: Number, data: string, hash?: string) {
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.hash = hash ?? calculateHash(this);
  }

  get isVerified() {
    return calculateHash(this) === this.hash;
  }

  isPreviousBlock(block: Block) {
    return block.hash === this.previousHash;
  }
}

const calculateHash = (block: Block): string => {
  const blockData = `${block.previousHash}${block.timestamp}${block.data}`;
  return createHash("sha256").update(blockData).digest("hex");
};

const createGenesisBlock = (): Block => {
  return new Block("0", Date.now(), "Genesis");
};

const generateNextBlock = (blockchain: Block[], blockData: string): Block => {
  const previousBlock = blockchain[blockchain.length - 1];
  const nextTimestamp = Date.now();
  const nextHash = previousBlock.hash;
  return new Block(nextHash, nextTimestamp, blockData);
};

const printBlockchain = (blockchain: Block[]): void => {
  let errorAfterUnverified = false;
  blockchain.forEach((block, i) => {
    if (i === 0) {
      console.log(`Block #${i}: ${block.data} [genesis]`);
      return;
    }

    if (errorAfterUnverified) {
      console.log(`Block #${i}: ${block.data} [above invalid]`);
      return;
    }

    if (block.isPreviousBlock(blockchain[i - 1])) {
      console.log(`Block #${i}: ${block.data} [confirmed]`);
    } else {
      console.error(`Block #${i}: ${block.data} [invalid]`);
      errorAfterUnverified = true;
    }
  });
};

const loadBlockchain = (): Block[] => {
  if (existsSync("blockchain.json")) {
    return JSON.parse(readFileSync("blockchain.json", "utf8")).map(
      (data: any) => new Block(data.previousHash, data.timestamp, data.data, data.hash)
    );
  } else {
    const genesisBlock = createGenesisBlock();
    const blockchain: Block[] = [genesisBlock];
    writeFileSync("blockchain.json", JSON.stringify(blockchain));
    return blockchain;
  }
};

const saveBlockchain = (blockchain: Block[]) => {
  writeFileSync("blockchain.json", JSON.stringify(blockchain));
};

const blockchain: Block[] = loadBlockchain();

class CLI {
  static async addBlock() {
    const blockData = await getUserInput("Block Data: ");
    const newBlock = generateNextBlock(blockchain, blockData);
    blockchain.push(newBlock);
    saveBlockchain(blockchain);
    console.log(`Block added. New Length: ${blockchain.length}`);
  }
  static async removeBlock() {
    const blockIndex = Number(await getUserInput("Block Index: "));
    if (blockIndex < blockchain.length) {
      blockchain.splice(blockIndex, 1);
      saveBlockchain(blockchain);
      console.log(`Block #${blockIndex} removed.`);
    } else {
      console.error("Invalid index.");
    }
  }
  static async modifyBlock() {
    const blockIndex = Number(await getUserInput("Block Index: "));
    const newMessage = await getUserInput("New Block Data: ");
    if (blockIndex < blockchain.length) {
      blockchain[blockIndex].data = newMessage;
      saveBlockchain(blockchain);
      console.log(`Block #${blockIndex} modified.`);
    } else {
      console.error("Invalid index.");
    }
  }
}

const main = async () => {
  console.log("\nBlockchain");
  console.log("1. View Blockchain");
  console.log("2. Add Block");
  console.log("3. Remove Block");
  console.log("4. Modify Block");
  console.log("5. Exit");

  const choice = Number(await getUserInput("> "));
  console.log("===============================");

  switch (choice) {
    case 1:
      printBlockchain(blockchain);
      break;
    case 2:
      await CLI.addBlock();
      break;
    case 3:
      await CLI.removeBlock();
      break;
    case 4:
      await CLI.modifyBlock();
      break;
    case 5:
      return process.exit();
    default:
      console.error("Invalid choice.");
      break;
  }
};

const loop = async () => {
  while (true) {
    await main();
  }
};

loop();
