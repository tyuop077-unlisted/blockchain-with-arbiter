import { createHash } from "crypto";
import { writeFileSync, readFileSync, existsSync } from "fs";
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
  index: number;
  previousHash: string;
  timestamp: Number;
  data: string;
  hash: string;

  constructor(index: number, previousHash: string, timestamp: Number, data: string, hash: string) {
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.hash = hash;
  }
}

const calculateHash = (block: Block): string => {
  const blockData = `${block.index}${block.previousHash}${block.timestamp}${block.data}`;
  return createHash("sha256").update(blockData).digest("hex");
};

const createGenesisBlock = (): Block => {
  const genesisBlock = new Block(0, "0", Date.now(), "Genesis", "Genesis");
  genesisBlock.hash = calculateHash(genesisBlock);
  return genesisBlock;
};

const generateNextBlock = (blockchain: Block[], blockData: string): Block => {
  const previousBlock = blockchain[blockchain.length - 1];
  const nextIndex = previousBlock.index + 1;
  const nextTimestamp = Date.now();
  const nextHash = previousBlock.hash;
  const newBlock = new Block(nextIndex, nextHash, nextTimestamp, blockData, "");
  newBlock.hash = calculateHash(newBlock);
  return newBlock;
};

const isValidNewBlock = (newBlock: Block, previousBlock: Block): boolean => {
  if (previousBlock.index + 1 != newBlock.index) {
    return false;
  } else if (previousBlock.hash != newBlock.previousHash) {
    return false;
  } else if (calculateHash(newBlock) != newBlock.hash) {
    return false;
  }
  return true;
};

const printBlockchain = (blockchain: Block[]): void => {
  let errorAfterUnverified = false;
  blockchain.forEach((block, i) => {
    if (i === 0) {
      console.log(`Block #${block.index}: ${block.data} [genesis]`);
      return;
    }

    if (errorAfterUnverified) {
      console.log(`Block #${block.index}: ${block.data} [above invalid]`);
      return;
    }

    if (isValidNewBlock(block, blockchain[i - 1])) {
      console.log(`Block #${block.index}: ${block.data} [confirmed]`);
    } else {
      console.error(`Block #${block.index}: ${block.data} [invalid]`);
      errorAfterUnverified = true;
    }
  });
};

const loadBlockchain = (): Block[] => {
  if (existsSync("blockchain.json")) {
    return JSON.parse(readFileSync("blockchain.json", "utf8")).map(
      (data: any) => new Block(data.index, data.previousHash, data.timestamp, data.data, data.hash)
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

  const choice = Number(await getUserInput("Choose an option: "));
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
