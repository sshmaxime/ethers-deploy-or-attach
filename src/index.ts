import { Signer, ContractFactory } from "ethers";

type AsyncReturnType<T extends (...args: any) => any> = T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : any;

export type Contract<F extends ContractFactory> = AsyncReturnType<F["deploy"]>;

//
export type FactoryConstructor<F extends ContractFactory> = {
  new (signer?: Signer): F;
};

// Contract Builders types
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

type ContractOutputAttachOnly<T extends Record<keyof T, ContractFactory>> = {
  [K in keyof T]: ContractBuilderAttachOnly<T[K]>;
} & { connect: (signer: Signer) => ContractOutputAttachOnly<T> };

//
export function buildContracts<T extends Record<keyof T, ContractFactory>>(
  contracts: { [K in keyof T]: FactoryConstructor<T[K]> },
  ethers: { getSigners(): Promise<any[]> }
): ContractOutput<T>;

export function buildContracts<T extends Record<keyof T, ContractFactory>>(contracts: {
  [K in keyof T]: FactoryConstructor<T[K]>;
}): ContractOutputAttachOnly<T>;

export function buildContracts<T extends Record<keyof T, ContractFactory>>(
  contracts: { [K in keyof T]: FactoryConstructor<T[K]> },
  ethers?: { getSigners(): Promise<any[]> }
): ContractOutput<T> | ContractOutputAttachOnly<T> {
  if (ethers) {
    const { deployOrAttach } = initDeployOrAttach(ethers);

    const myBuildContracts = (signer?: Signer): ContractOutput<T> => {
      const builtContracts: { [contractName: string]: any } = {};

      for (const x in contracts) {
        builtContracts[x] = deployOrAttach(contracts[x] as any, signer);
      }

      return { ...(builtContracts as any), connect: (signer: Signer) => myBuildContracts(signer) };
    };
    return myBuildContracts();
  } else {
    const myBuildContracts = (signer?: Signer): ContractOutputAttachOnly<T> => {
      const builtContracts: { [contractName: string]: any } = {};

      for (const x in contracts) {
        builtContracts[x] = attach(contracts[x] as any, signer);
      }

      return { ...(builtContracts as any), connect: (signer: Signer) => myBuildContracts(signer) };
    };
    return myBuildContracts();
  }
}

const attach = <F extends ContractFactory>(
  FactoryConstructor: FactoryConstructor<F>,
  initialSigner?: Signer
) => {
  return {
    attach: (address: string, signer?: Signer): Contract<F> => {
      const defaultSigner = initialSigner || signer;
      return new FactoryConstructor(defaultSigner).attach(address) as Contract<F>;
    },
  };
};

const initDeployOrAttach = (ethers: { getSigners(): Promise<any[]> }) => {
  const attach = <F extends ContractFactory>(
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: Signer
  ) => {
    return {
      attach: async (address: string, signer?: Signer): Promise<Contract<F>> => {
        const defaultSigner = initialSigner || (await ethers.getSigners())[0];
        return new FactoryConstructor(signer || defaultSigner).attach(address) as Contract<F>;
      },
    };
  };

  const deployOrAttach = <F extends ContractFactory>(
    FactoryConstructor: FactoryConstructor<F>,
    initialSigner?: Signer
  ): ContractBuilder<F> => {
    return {
      deploy: async (...args: Parameters<F["deploy"]>): Promise<Contract<F>> => {
        const defaultSigner = initialSigner || (await ethers.getSigners())[0];
        return new FactoryConstructor(defaultSigner).deploy(...(args || [])) as Contract<F>;
      },
      attach: attach(FactoryConstructor, initialSigner).attach,
    };
  };

  return {
    deployOrAttach,
    attach,
  };
};
