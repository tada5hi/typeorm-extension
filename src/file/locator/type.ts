export type LocatorInfo = {
    path: string,
    fileName: string,
    fileExtension: '.js' | '.ts' | '.json' | string
};

export type LocatorOptions = {
    extensions: string[] | string,
    paths: string | string[],
};
