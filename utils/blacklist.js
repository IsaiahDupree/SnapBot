// Blacklist configuration for recipients
export const BLACKLISTED_RECIPIENTS = [
    'Team Snapchat',
    'team snapchat',
    'TEAM SNAPCHAT'
];

export function isBlacklisted(recipientName) {
    if (!recipientName) return false;
    const lowerName = recipientName.toLowerCase().trim();
    return BLACKLISTED_RECIPIENTS.some(blocked =>
        blocked.toLowerCase() === lowerName
    );
}

export function filterBlacklisted(recipients) {
    return recipients.filter(r => !isBlacklisted(r.name));
}

export default { BLACKLISTED_RECIPIENTS, isBlacklisted, filterBlacklisted };
