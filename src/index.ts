import { Signer, ContractFactory } from "ethers";

type AsyncReturnType<T extends (...args: any) => any> = T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : any;

export type Contract<F extends ContractFactory> = AsyncReturnType<F["deploy"]>;

type inputContracts = {
  [contractName: string]:
    | ReturnType<ReturnType<typeof initDeployOrAttach>["deployOrAttach"]>
    | ReturnType<ReturnType<typeof initDeployOrAttach>["attach"]>;
};

export type outputContracts = inputContracts & {
  connect: (signer: Signer) => outputContracts;
};

export interface ContractBuilder<F extends ContractFactory> {
  deploy(...args: Parameters<F["deploy"]>): Promise<Contract<F>>;
  attach(address: string, signer?: Signer): Promise<Contract<F>>;
}

export type FactoryConstructor<F extends ContractFactory> = {
  new (signer?: Signer): F;
};

export const buildContracts = <T extends Record<keyof T, ContractFactory>>(
  contracts: { [K in keyof T]: FactoryConstructor<T[K]> },
  ethers: { getSigners(): Promise<any[]> }
) => {
  const { deployOrAttach } = initDeployOrAttach(ethers);

  const buildContracts = (signer?: Signer) => {
    const a: { [contractName: string]: any } = {};

    for (const x in contracts) {
      a[x] = deployOrAttach(contracts[x] as any, signer);
    }

    type MySuperType<T extends Record<keyof T, ContractFactory>> = {
      [K in keyof T]: ContractBuilder<T[K]>;
    };

    return a as MySuperType<T>;
  };

  return {
    ...buildContracts(),
    connect: (signer: Signer) => buildContracts(signer),
  };
};

export const initDeployOrAttach = (ethers: { getSigners(): Promise<any[]> }) => {
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
    // const contractName = FactoryConstructor.name.replace("__factory", "");
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
