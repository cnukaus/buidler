import Transaction from "ethereumjs-tx";
import {
  addHexPrefix,
  privateToAddress,
  stripHexPrefix,
  toBuffer
} from "ethereumjs-util";
import { Account } from "web3x/account";
import { Tx } from "web3x/eth";

import { IEthereumProvider } from "./ethereum";
import { wrapSend } from "./wrapper";

export function createLocalAccountsProvider(
  provider: IEthereumProvider,
  privateKeys: string[]
) {
  const accounts: Account[] = privateKeys.map(pkString =>
    Account.fromPrivate(toBuffer(pkString))
  );

  let obtainedChainId: number | undefined;

  return wrapSend(provider, async (method: string, params: any[]) => {
    if (method === "eth_accounts" || method === "eth_requestAccounts") {
      return accounts.map(acc => acc.address.toLowerCase());
    }

    if (method === "eth_sign") {
      // TODO: This should be supported before the first version
      throw new Error("eth_sign is not supported yet");
    }

    if (method === "eth_sendTransaction" && params.length > 0) {
      const tx: Tx = params[0];

      if (obtainedChainId === undefined) {
        obtainedChainId = parseInt(await provider.send("net_version"), 10);
      }

      if (tx.chainId !== undefined && tx.chainId !== obtainedChainId) {
        // TODO: This should be handled differently
        throw Error("chainIds don't match");
      }

      tx.chainId = obtainedChainId;

      if (tx.gas === undefined || tx.gasPrice === undefined) {
        throw Error("Missing gas info");
      }

      if (tx.from === undefined) {
        // TODO: This should be handled differently
        tx.from = accounts[0].address.toLowerCase();
      }

      if (tx.nonce === undefined) {
        tx.nonce = await provider.send("eth_getTransactionCount", [
          tx.from,
          "pending"
        ]);
      }

      const account = accounts.find(
        acc => acc.address.toLowerCase() === tx.from!.toLowerCase()
      );

      if (account === undefined) {
        // TODO: Throw a better error
        throw new Error(tx.from + " isn't one of the local accounts");
      }

      // TODO: Remove ethereumjs-tx dependencies in favor of web3x.
      const transaction = new Transaction(tx);
      transaction.sign(account.privateKey);

      return provider.send("eth_sendRawTransaction", [transaction.serialize()]);
    }

    return provider.send(method, params);
  });
}
