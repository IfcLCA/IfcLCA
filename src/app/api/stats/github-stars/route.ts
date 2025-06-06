import { NextResponse } from 'next/server';

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

            // Return fallback values instead of throwing
            if (repoResponse.status === 403) {
                console.log('Rate limit likely exceeded, returning cached values');
                return NextResponse.json({
                    stars: 22,
                    contributors: 2,
                    commits: 13
                });
            }

            throw new Error(`Failed to fetch repository data: ${repoResponse.status}`);
        }

        const repoData = await repoResponse.json();
        const stars = repoData.stargazers_count || 0;

        // Fetch contributors count
        const contributorsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100&anon=true`, {
            headers,
            next: { revalidate: 3600 }
        });

        if (!contributorsResponse.ok) {
            throw new Error('Failed to fetch contributors');
        }

        const contributors: GitHubContributor[] = await contributorsResponse.json();
        const contributorsCount = contributors.length;

        // For commits count, we'll use the repository's commit count from the main branch
        // Note: Getting exact total commits requires pagination through all commits which is expensive
        // Instead, we'll use an approximation based on the default branch
        let commitsCount = 0;

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
            // Use a reasonable fallback
            commitsCount = 100;
        }

        return NextResponse.json({
            stars,
            contributors: contributorsCount,
            commits: commitsCount
        });
    } catch (error) {
        console.error('Error fetching GitHub metrics:', error);

        // Return fallback values if there's an error
        return NextResponse.json({
            stars: 0,
            contributors: 0,
            commits: 0
        });
    }
} 