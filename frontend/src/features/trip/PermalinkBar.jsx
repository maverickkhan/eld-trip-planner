import { useState } from 'react'
import { Button, IconButton, Link, Paper, Tooltip, Typography } from '@mui/material'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import CheckIcon from '@mui/icons-material/Check'

export default function PermalinkBar({ id }) {
  const url = `${window.location.origin}/trips/${id}`
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', url)
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: `ELD trip plan #${id}`, url })
        return
      } catch {
        /* user cancelled */
      }
    }
    copy()
  }

  return (
    <Paper className="no-print" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1 }}>
      <LinkOutlinedIcon color="primary" fontSize="small" />
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        Permalink:
      </Typography>
      <Link href={url} variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
        {url}
      </Link>
      <Button
        size="small"
        variant="outlined"
        onClick={copy}
        startIcon={copied ? <CheckIcon fontSize="small" /> : <ContentCopyOutlinedIcon fontSize="small" />}
        sx={{ whiteSpace: 'nowrap' }}
      >
        {copied ? 'Copied' : 'Copy link'}
      </Button>
      <Tooltip title="Share">
        <IconButton size="small" onClick={share} aria-label="Share trip link">
          <ShareOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  )
}
