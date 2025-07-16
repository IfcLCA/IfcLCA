import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

interface GitHubMetrics {
    stars: number;
    contributors: number;
    commits: number;
}

const cacheFile = path.join(os.tmpdir(), 'githubMetricsCache.json');
let cachedMetrics: GitHubMetrics = { stars: 22, contributors: 2, commits: 13 };

async function loadCache() {
    try {
        const data = await fs.readFile(cacheFile, 'utf-8');
        cachedMetrics = JSON.parse(data) as GitHubMetrics;
    } catch {
        // ignore if file doesn't exist or can't be parsed
    }
}

async function saveCache() {
    try {
        await fs.writeFile(cacheFile, JSON.stringify(cachedMetrics), 'utf-8');
    } catch (err) {
        console.error('Failed to write GitHub metrics cache', err);
    }
}

loadCache();

interface GitHubContributor {
    login: string;
    id: number;
    contributions: number;
}

export async function GET() {
    try {
        const owner = 'IfcLCA';
        const repo = 'IfcLCA';
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
        };

        // Add authorization header if GitHub token is available
        if (process.env.GITHUB_TOKEN) {
            headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
            console.log('Using GitHub token for authentication');
        } else {
            console.log('No GitHub token found, using unauthenticated requests');
        }

        // Fetch repository data (includes star count)
        const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers,
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (!repoResponse.ok) {
            const errorData = await repoResponse.json().catch(() => ({}));
            console.error('GitHub API Error:', {
                status: repoResponse.status,
                statusText: repoResponse.statusText,
                error: errorData,
                hasToken: !!process.env.GITHUB_TOKEN
            });

            return NextResponse.json(cachedMetrics);
        }

        const repoData = await repoResponse.json();
        const stars = repoData.stargazers_count || cachedMetrics.stars;

        // Fetch contributors count
        const contributorsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100&anon=true`, {
            headers,
            next: { revalidate: 3600 }
        });

        if (!contributorsResponse.ok) {
            return NextResponse.json(cachedMetrics);
        }

        const contributors: GitHubContributor[] = await contributorsResponse.json();
        const contributorsCount = contributors.length;

        // For commits count, we'll use the repository's commit count from the main branch
        // Note: Getting exact total commits requires pagination through all commits which is expensive
        // Instead, we'll use an approximation based on the default branch
        let commitsCount = cachedMetrics.commits;

        try {
            const defaultBranch = repoData.default_branch || 'main';
            const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?sha=${defaultBranch}&per_page=1`, {
                headers,
                next: { revalidate: 3600 }
            });

            // GitHub returns the total count in the Link header for pagination
            const linkHeader = commitResponse.headers.get('Link');
            if (linkHeader) {
                // Parse the last page number from Link header
                const match = linkHeader.match(/page=(\d+)>; rel="last"/);
                if (match) {
                    commitsCount = parseInt(match[1]);
                }
            }

            // If we couldn't get from Link header, at least count this page
            if (commitsCount === 0 && commitResponse.ok) {
                const commits = await commitResponse.json();
                commitsCount = commits.length;
            }
        } catch (error) {
            console.error('Error fetching commits count:', error);
            commitsCount = cachedMetrics.commits;
        }
        cachedMetrics = {
            stars,
            contributors: contributorsCount,
            commits: commitsCount
        };
        await saveCache();
        return NextResponse.json(cachedMetrics);
    } catch (error) {
        console.error('Error fetching GitHub metrics:', error);
        return NextResponse.json(cachedMetrics);
    }
}
