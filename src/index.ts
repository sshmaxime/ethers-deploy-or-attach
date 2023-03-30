import { Signer, ContractFactory, providers } from "ethers";

// Get the return type of a function T that works with async methods
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : any;

export type SignerOrProvider = Signer | providers.Provider;

export type Contract<F extends ContractFactory> = ReturnType<F["deploy"]>;

export type FactoryConstructor<F extends ContractFactory> = {
  new (signer?: Signer): F;
};

////////////////////
// General System //
////////////////////

export interface ContractBuilder<F extends ContractFactory> {
  deploy(...args: Parameters<F["deploy"]>): Promise<Contract<F>>;
  attach(address: string, signer?: Signer): Contract<F>;
}

// Contract Outputs types
type ContractOutput<T extends Record<keyof T, ContractFactory>> = {
  [K in keyof T]: ContractBuilder<T[K]>;
} & { connect: (signer: Signer | providers.Provider) => ContractOutput<T> };

export const buildContracts = <T extends Record<keyof T, ContractFactory>>(
  contracts: { [K in keyof T]: FactoryConstructor<T[K]> },
  signerOrProvider: SignerOrProvider
): ContractOutput<T> => {
  const { deployOrAttach } = initDeployOrAttach();

  const myBuildContracts = (signer?: SignerOrProvider): ContractOutput<T> => {
    const builtContracts: { [contractName: string]: any } = {};

    for (const x in contracts) {
      builtContracts[x] = deployOrAttach(contracts[x], signer);
    }

    return { ...(builtContracts as any), connect: (signer: Signer) => myBuildContracts(signer) };
  };

  return myBuildContracts(signerOrProvider);
};

const initDeployOrAttach = () => {
  const attach = <F extends ContractFactory>(
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: SignerOrProvider
  ) => {
    return {
      attach: (address: string, _signer?: SignerOrProvider): Contract<F> => {
        const signer = _signer || initialSigner;
        let contract = new FactoryConstructor().attach(address) as any;
        if (signer) {
          contract = contract.connect(signer);
        }
        return contract as Contract<F>;
      },
    };
  };

  const deployOrAttach = <F extends ContractFactory>(
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: SignerOrProvider
  ): ContractBuilder<F> => {
    return {
      deploy: async (...args: Parameters<F["deploy"]>): Promise<Contract<F>> => {
        return new FactoryConstructor().deploy(...(args || [])) as Contract<F>;
      },
      attach: attach<F>(FactoryConstructor, initialSigner).attach,
    };
  };

  return {
    deployOrAttach,
    attach,
  };
};

////////////////////
// Hardhat System //
////////////////////

export interface ContractBuilderHardhat<F extends ContractFactory> {
  deploy(...args: Parameters<F["deploy"]>): Promise<Contract<F>>;
  attach(address: string, signer?: Signer): Promise<Contract<F>>;
}

// Contract Outputs types
type ContractOutputHardhat<T extends Record<keyof T, ContractFactory>> = {
  [K in keyof T]: ContractBuilderHardhat<T[K]>;
} & { connect: (signer: Signer | providers.Provider) => ContractOutputHardhat<T> };

export const buildContractsHardhat = <T extends Record<keyof T, ContractFactory>>(
  contracts: { [K in keyof T]: FactoryConstructor<T[K]> },
  hardhatEthers?: { getSigners(): Promise<Signer[]> }
): ContractOutputHardhat<T> => {
  const { deployOrAttach } = initDeployOrAttachHardhat(hardhatEthers);

  const myBuildContracts = (signer?: Signer): ContractOutputHardhat<T> => {
    const builtContracts: { [contractName: string]: any } = {};

    for (const x in contracts) {
      builtContracts[x] = deployOrAttach(contracts[x], signer);
    }

    return { ...(builtContracts as any), connect: (signer: Signer) => myBuildContracts(signer) };
  };

  return myBuildContracts();
};

const initDeployOrAttachHardhat = (ethers?: { getSigners(): Promise<Signer[]> }) => {
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
  ): ContractBuilderHardhat<F> => {
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
