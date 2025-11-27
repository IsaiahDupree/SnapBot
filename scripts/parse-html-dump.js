import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('data/page_dump.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('Parsing HTML dump...');

// Find inputs
const inputRegex = /<input[^>]*>/g;
const inputs = html.match(inputRegex) || [];
console.log(`\nFound ${inputs.length} inputs:`);
inputs.forEach(input => {
    if (input.includes('type="file"') || input.includes('type=\'file\'')) {
        console.log(`   FILE INPUT: ${input}`);
    }
});

// Find buttons with interesting keywords
// Note: This regex is simple and might fail on nested tags, but good enough for a dump
const buttonRegex = /<button[^>]*>.*?<\/button>/gs;
const buttons = html.match(buttonRegex) || [];
console.log(`\nFound ${buttons.length} buttons.`);

console.log('Potential upload buttons:');
buttons.forEach(btn => {
    const lower = btn.toLowerCase();
    if (lower.includes('upload') || lower.includes('gallery') || lower.includes('memories') || lower.includes('import')) {
        console.log(`   ${btn.replace(/\s+/g, ' ').substring(0, 200)}...`);
    }
});

// Check for iframes
const iframeRegex = /<iframe[^>]*>/g;
const iframes = html.match(iframeRegex) || [];
console.log(`\nFound ${iframes.length} iframes.`);
iframes.forEach(iframe => console.log(`   ${iframe}`));
