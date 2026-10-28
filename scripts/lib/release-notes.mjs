export function releaseNotes(changelog, tag, repositoryUrl, previousTag = null) {
    const isVersion = value => /^v\d+\.\d+\.\d+$/.test(value);
    if (!isVersion(tag) || (previousTag !== null && !isVersion(previousTag)))
        throw new Error('Release notes require version tags.');
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repositoryUrl))
        throw new Error('Release notes require a GitHub repository URL.');
    const version = tag.slice(1);
    const section = changelog.split(/^## /m).find(part => part.startsWith(`${version} `) || part.startsWith(`${version}\n`));
    if (!section) throw new Error(`No changelog section for ${version}`);
    const repository = repositoryUrl.replace(/\/$/, '');
    const label = previousTag ? `${previousTag}...${tag}` : tag;
    const url = previousTag ? `${repository}/compare/${label}` : `${repository}/commits/${tag}`;
    return `## ${section.trim()}\n\n**Full Changelog**: [${label}](${url})\n`;
}
