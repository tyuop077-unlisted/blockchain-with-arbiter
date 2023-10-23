import { createHash, createPublicKey, createVerify } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import * as readline from "readline";

let ARBITER_PUBLIC_KEY: string;

const verifier = createVerify("RSA-SHA256");

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

interface IBlock {
  previousHash: string;
  timestamp: number;
  data: string;
  signature?: string;
  hash?: string;
}

export class Block implements IBlock {
  previousHash: string;
  timestamp: number;
  data: string;
  hash: string;
  signature?: string;

  constructor(blockData: IBlock) {
    this.previousHash = blockData.previousHash;
    this.timestamp = blockData.timestamp;
    this.data = blockData.data;
    this.hash = blockData.hash ?? calculateHash(this);
    this.signature = blockData.signature;
  }

  get isVerified() {
    verifier.update(`${this.previousHash}${this.timestamp}${this.data}${this.signature}`);
    const publicKeyBuffer = Buffer.from(ARBITER_PUBLIC_KEY, "hex");
    console.log(this.signature);
    const publicKeyObject = createPublicKey({
      key: publicKeyBuffer,
      format: "der",
      type: "pkcs1",
    });
    return verifier.verify(publicKeyObject, this.signature!, "hex");
  }

  isPreviousBlock(block: Block) {
    return block.hash === this.previousHash;
  }

  async sign() {
    this.signature = await fetch(`http://itislabs.ru/ts?digest=${calculateHash(this)}`, {
      headers: {
        "content-type": "application/json",
      },
    })
      .then(r => r.json())
      .then(r => r.timeStampToken.signature);
    console.log(`Signed ${this.hash.substring(0, 5)}`);
  }
}

const calculateHash = (block: Block): string => {
  const blockData = `${block.previousHash}${block.timestamp}${block.data}${block.signature}`;
  return createHash("sha256").update(blockData).digest("hex");
};

const createGenesisBlock = (): Block => {
  return new Block({
    // "", Date.now(), "Genesis", ""
    previousHash: "",
    timestamp: Date.now(),
    data: "Genesis",
    hash: undefined,
    signature: undefined,
  });
};

const generateNextBlock = async (previousBlock: Block, blockData: string): Promise<Block> => {
  const timestamp = Date.now();
  const block = new Block({
    previousHash: previousBlock.hash,
    timestamp,
    data: blockData,
    signature: undefined,
    hash: undefined,
  });
  await block.sign();
  return block;
};

const printBlockchain = (blockchain: Block[]): void => {
  let errorAfterUnverified = false;
  let label = "unknown";
  blockchain.forEach((block, i) => {
    if (i === 0) {
      label = "genesis";
    } else if (errorAfterUnverified) {
      label = "above invalid";
    } else if (block.isPreviousBlock(blockchain[i - 1]) && block.isVerified) {
      label = "confirmed";
    } else {
      label = "invalid";
      errorAfterUnverified = true;
    }
    console.log(`Block #${i} (${block.hash.substring(0, 5)}): ${block.data} [${label}]`);
  });
};

const loadBlockchain = (): Block[] => {
  if (existsSync("blockchain.json")) {
    return JSON.parse(readFileSync("blockchain.json", "utf8")).map(
      (data: IBlock) =>
        new Block({
          previousHash: data.previousHash,
          data: data.data,
          hash: data.hash,
          signature: data.signature,
          timestamp: data.timestamp,
        })
    );
  } else {
    const genesisBlock = createGenesisBlock();
    const blockchain: Block[] = [genesisBlock];
    saveBlockchain(blockchain);
    return blockchain;
  }
};

const saveBlockchain = (blockchain: Block[]) => {
  writeFileSync("blockchain.json", JSON.stringify(blockchain, null, 2) + "\n");
};

const blockchain: Block[] = loadBlockchain();

class CLI {
  static async addBlock() {
    const blockData = await getUserInput("Block Data: ");
    const newBlock = await generateNextBlock(blockchain.at(-1)!, blockData);
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
  /*await fetch("http://itislabs.ru/ts/public")
    .then(r => r.text())
    .then(data => (ARBITER_PUBLIC_KEY = data));
  console.log(`pubkey: ${ARBITER_PUBLIC_KEY}`);*/
  ARBITER_PUBLIC_KEY =
    "30819f300d06092a864886f70d010101050003818d0030818902818100a811365d2f3642952751029edf87c8fa2aeb6e0" +
    "feafcf800190a7dd2cf750c63262f6abd8ef52b251c0e10291d5e2f7e6682de1aae1d64d4f9b242050f898744ca300a44c" +
    "4d8fc8af0e7a1c7fd9b606d7bde304b29bec01fbef554df6ba1b7b1ec355e1ff68bd37f3d40fb27d1aa233fe3dd6b63f72" +
    "41e734739851ce8c590f70203010001";
  while (true) {
    await main();
  }
};

loop();
