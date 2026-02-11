/**
 * Creates a Mongoose Model mock. Each find/findOne/findById returns a chain
 * with populate(), lean(), sort(), exec(). Override via mockReturnValue or
 * mockResolvedValue on the method.
 */
export function createMongooseModelMock() {
  const createChain = (execResult: unknown) => {
    const chain = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(execResult),
    };
    return chain;
  };

  const defaultFindOne = createChain(null);
  const defaultFind = createChain([]);
  const defaultFindById = createChain(null);
  const defaultCount = createChain(0);

  const find = jest.fn().mockReturnValue(defaultFind);
  const findOne = jest.fn().mockReturnValue(defaultFindOne);
  const findById = jest.fn().mockReturnValue(defaultFindById);
  const countDocuments = jest.fn().mockReturnValue(defaultCount);

  return {
    find,
    findOne,
    findById,
    findByIdAndUpdate: jest.fn().mockReturnValue(createChain(null)),
    findByIdAndDelete: jest.fn().mockReturnValue(createChain(null)),
    create: jest.fn().mockImplementation((doc: unknown) =>
      Promise.resolve({
        _id: { toString: () => 'mock-id' },
        toObject: () => ({ ...(doc as object), _id: 'mock-id' }),
        ...(doc as object),
      }),
    ),
    countDocuments,
    updateOne: jest.fn().mockImplementation(() => ({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    })),
    deleteOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    }),
    // Helpers: make findOne().exec() resolve to value
    mockFindOneResult: (value: unknown) => {
      findOne.mockReturnValue(createChain(value));
    },
    mockFindResult: (value: unknown[]) => {
      find.mockReturnValue(createChain(value));
    },
    mockFindByIdResult: (value: unknown) => {
      findById.mockReturnValue(createChain(value));
    },
    mockCountResult: (n: number) => {
      countDocuments.mockReturnValue(createChain(n));
    },
  };
}
