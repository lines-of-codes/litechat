/// Shades of a color in a Tailwind style.
export interface ColorShades {
	/// The lightest variant of the color. Used for text color.
	50?: string;
	/// Neutral accent color.
	500?: string;
	/// A darker variant of the color. Used for the border of some elements.
	600?: string;
	/// A more darker variant of the color. Used for backgrounds and gradients.
	700?: string;
	/// An even darker variant of the color. Used for the border of some elements.
	800?: string;
	/// The almost darkest variant of the color. Used for gradients.
	900?: string;
}

export function applyTheme(shades: ColorShades) {
	if (shades[50]) {
		document.documentElement.style.setProperty("--color-50", shades[50]);
	}

	if (shades[600]) {
		document.documentElement.style.setProperty("--color-600", shades[600]);
	}

	if (shades[700]) {
		document.documentElement.style.setProperty("--color-700", shades[700]);
	}

	if (shades[800]) {
		document.documentElement.style.setProperty("--color-800", shades[800]);
	}

	if (shades[900]) {
		document.documentElement.style.setProperty("--color-900", shades[900]);
	}
}

let moduleCache: { [key: string]: any } = {};

export async function fetchAndApplyTheme(name: string) {
	const mod = moduleCache[name] ?? (await import(`./${name}.theme.ts`));
	applyTheme(mod.shades as ColorShades);
}
