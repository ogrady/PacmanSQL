// neat little trick I stole from https://stackoverflow.com/a/37417976
export const range = (length: number): number[] => Array(length).fill(undefined).map((element, index) => index);

// https://stackoverflow.com/a/22015930
export const zip = <A,B>(xs: A[], ys: B[]) : [A,B][] => xs.map((k, i) => [k, ys[i]]);

// https://stackoverflow.com/a/4550514
export const choice = <A>(xs: A[]): A => xs[Math.floor(Math.random() * xs.length)];
