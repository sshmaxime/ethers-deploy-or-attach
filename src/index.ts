import { isNode } from "browser-or-node";
import { Signer, ContractFactory } from "ethers";

// Get the return type of the function T that works with async methods
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : any;

export type Contract<F extends ContractFactory> = ReturnType<F["deploy"]>;

export type FactoryConstructor<F extends ContractFactory> = {
  new (signer?: Signer): F;
};

export interface ContractBuilder<F extends ContractFactory> {
  deploy(...args: Parameters<F["deploy"]>): Promise<Contract<F>>;
  attach(address: string, signer?: Signer): Promise<Contract<F>>;
}

export interface ContractBuilderAttachOnly<F extends ContractFactory> {
  attach(address: string, signer?: Signer): Contract<F>;
}

// Contract Outputs types
type ContractOutput<T extends Record<keyof T, ContractFactory>> = {
  [K in keyof T]: ContractBuilder<T[K]>;
} & { connect: (signer: Signer) => ContractOutput<T> };

// In a hardhat project
export function buildContracts<T extends Record<keyof T, ContractFactory>>(
  contracts: { [K in keyof T]: FactoryConstructor<T[K]> },
  ethers: { getSigners(): Promise<any[]> }
): ContractOutput<T>;

// In the browser
export function buildContracts<T extends Record<keyof T, ContractFactory>>(contracts: {
  [K in keyof T]: FactoryConstructor<T[K]>;
}): ContractOutput<T>;

export function buildContracts<T extends Record<keyof T, ContractFactory>>(
  contracts: { [K in keyof T]: FactoryConstructor<T[K]> },
  ethers?: { getSigners(): Promise<any[]> }
): ContractOutput<T> {
  const { deployOrAttach } = initDeployOrAttach(ethers);

  const myBuildContracts = (signer?: Signer): ContractOutput<T> => {
    const builtContracts: { [contractName: string]: any } = {};

    for (const x in contracts) {
      builtContracts[x] = deployOrAttach(contracts[x] as any, signer);
    }

    return { ...(builtContracts as any), connect: (signer: Signer) => myBuildContracts(signer) };
  };
  return myBuildContracts();
}

const initDeployOrAttach = (ethers?: { getSigners(): Promise<any[]> }) => {
  const attach = <F extends ContractFactory>(
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: Signer
  ) => {
    return {
      attach: async (address: string, signer?: Signer): Promise<Contract<F>> => {
        const ethersDefaultSigner = ethers ? (await ethers.getSigners())[0] : undefined;
        const defaultSigner = signer || initialSigner;
        return new FactoryConstructor(defaultSigner || ethersDefaultSigner).attach(
          address
        ) as Contract<F>;
      },
    };
  };

  const deployOrAttach = <F extends ContractFactory>(
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: Signer
  ): ContractBuilder<F> => {
    return {
      deploy: async (...args: Parameters<F["deploy"]>): Promise<Contract<F>> => {
        const ethersDefaultSigner = ethers ? (await ethers.getSigners())[0] : undefined;
        return new FactoryConstructor(initialSigner || ethersDefaultSigner).deploy(
          ...(args || [])
        ) as Contract<F>;
      },
      attach: attach<F>(FactoryConstructor, initialSigner).attach,
    };
  };

  return {
    deployOrAttach,
    attach,
  };
};
