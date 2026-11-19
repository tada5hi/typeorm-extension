export type TeFooterLink = {
    text: string;
    link: string;
};

export type TeFooterColumn = {
    title: string;
    links: TeFooterLink[];
};

export type TeFooterConfig = {
    tagline: string;
    columns: TeFooterColumn[];
    note?: string;
};

export type TeThemeConfig = {
    teFooter?: TeFooterConfig;
};
