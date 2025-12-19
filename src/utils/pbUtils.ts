const snakecaseSplitRegex = new RegExp(/[\W_]+/);
const extInvalidCharsRegex = new RegExp(/[^\w.*\-+=#]+/g);

function isUpper(char: string) {
    if (!isNaN(parseInt(char))) {
        return false;
    }

    if (char === char.toUpperCase()) {
        return true;
    }

    return false;
}

/**
 * A function that mimics PocketBase's snakecase function behaviour.
 * Original code: https://github.com/pocketbase/pocketbase/blob/37ff943f6704b8d55390847114a9cc23badc0632/tools/inflector/inflector.go#L58
 * @param str The string to transform
 */
function snakecase(str: string): string {
    const words = str.split(snakecaseSplitRegex);
    let result = "";

    for (let i = 0; i < words.length; i++) {
        const word = words[i];

        if (word === "") continue;

        if (result.length > 0) {
            result += "_";
        }

        for (let j = 0; j < word.length; j++) {
            const c = word[j];

            if (isUpper(c) && j > 0 && !isUpper(word[j - 1])) {
                result += "_";
            }

            result += c;
        }
    }

    return result.toLowerCase();
}

/**
 * Extracts the file extension from a file name.
 * Original code: https://github.com/pocketbase/pocketbase/blob/37ff943f6704b8d55390847114a9cc23badc0632/tools/filesystem/file.go#L226
 * @param name The file name
 * @returns The file extension
 */
export function extractExtension(name: string): string {
    const primaryDot = name.lastIndexOf(".");

    if (primaryDot === -1) {
        return "";
    }

    const secondaryDot = name.substring(0, primaryDot).lastIndexOf(".");

    if (secondaryDot >= 0) {
        return name.substring(secondaryDot);
    }

    return name.substring(primaryDot);
}

/**
 * An inaccurate re-implementation of the same function in PocketBase's Go code.
 * Original code: https://github.com/pocketbase/pocketbase/blob/37ff943f6704b8d55390847114a9cc23badc0632/tools/filesystem/file.go#L183
 * @param fileName The file name to be transformed
 * @returns The "normalized file name"
 */
export function normalizeName(fileName: string) {
    const originalExt = extractExtension(fileName);
    let cleanExt = originalExt.replaceAll(extInvalidCharsRegex, "");

    if (cleanExt.length > 20) {
        cleanExt = "." + cleanExt.substring(cleanExt.length - 20);
    }

    let cleanName = snakecase(
        fileName.substring(0, fileName.length - originalExt.length)
    );

    if (cleanName.length < 3) {
        // Pretend that it's a string of random characters
        cleanName += "aaaaaaaaaa";
    } else if (cleanName.length > 100) {
        cleanName = cleanName.substring(0, 100);
    }

    return `${cleanName}_aaaaaaaaaa${cleanExt}`;
}
