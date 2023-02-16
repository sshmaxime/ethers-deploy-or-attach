import { Signer, ContractFactory } from "ethers";

type AsyncReturnType<T extends (...args: any) => any> = T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : any;

export type Contract<F extends ContractFactory> = AsyncReturnType<F["deploy"]>;

export interface ContractBuilder<F extends ContractFactory> {
  deploy(...args: Parameters<F["deploy"]>): Promise<Contract<F>>;
  attach(address: string, signer?: Signer): Promise<Contract<F>>;
}

export interface ContractBuilder2<F extends ContractFactory> {
  attach(address: string, signer?: Signer): Contract<F>;
}

export type FactoryConstructor<F extends ContractFactory> = {
  new (signer?: Signer): F;
};

type MySuperType<T extends Record<keyof T, ContractFactory>> = {
  [K in keyof T]: ContractBuilder<T[K]>;
};

type MySuperType2<T extends Record<keyof T, ContractFactory>> = {
  [K in keyof T]: ContractBuilder2<T[K]>;
};

type output<T extends Record<keyof T, ContractFactory>> = MySuperType<T> & {
  connect: (signer: Signer) => output<T>;
};

type output2<T extends Record<keyof T, ContractFactory>> = MySuperType2<T> & {
  connect: (signer: Signer) => output2<T>;
};

export function buildContracts<T extends Record<keyof T, ContractFactory>>(
  contracts: { [K in keyof T]: FactoryConstructor<T[K]> },
  ethers: { getSigners(): Promise<any[]> }
): output<T>;

export function buildContracts<T extends Record<keyof T, ContractFactory>>(contracts: {
  [K in keyof T]: FactoryConstructor<T[K]>;
}): output2<T>;

export function buildContracts<T extends Record<keyof T, ContractFactory>>(
  contracts: { [K in keyof T]: FactoryConstructor<T[K]> },
  ethers?: { getSigners(): Promise<any[]> }
): output<T> | output2<T> {
  //
  if (ethers) {
    const { deployOrAttach } = initDeployOrAttach(ethers);

    const myBuildContracts = (signer?: Signer) => {
      const a: { [contractName: string]: any } = {};

      for (const x in contracts) {
        a[x] = deployOrAttach(contracts[x] as any, signer);
      }

      const result = a as MySuperType<T>;

      return { ...result, connect: (signer: Signer) => myBuildContracts(signer) };
    };
    return myBuildContracts();
  } else {
    const { attach } = initAttachOnly();

    const myBuildContracts = (signer?: Signer) => {
      const a: { [contractName: string]: any } = {};

      for (const x in contracts) {
        a[x] = attach(contracts[x] as any, signer);
      }

      const result = a as MySuperType2<T>;

      return { ...result, connect: (signer: Signer) => myBuildContracts(signer) };
    };
    return myBuildContracts();
  }
}

const initAttachOnly = () => {
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

  return { attach };
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
      attach: attach<F>(FactoryConstructor, initialSigner).attach,
    };
  };

  return {
    deployOrAttach,
    attach,
  };
};
