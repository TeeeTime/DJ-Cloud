"use client";

import React from "react";
import { Play, Pause, Download, Pencil, Trash, Settings2, CloudUpload, Link as LinkIcon, Search, MoreHorizontal, ArrowUpDown, ChevronUp, ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { usePlayer } from "@/components/providers/player-provider";
import { Track } from "@/lib/data";
import { Sidebar } from "@/components/layout/sidebar";

export function LibraryView() {
  const {
    activeFilter,
    filteredTracks,
    sortedTracks,
    currentTrack,
    setCurrentTrack,
    isPlaying,
    setIsPlaying,
    handleSort,
    sortConfig,
    searchQuery,
    setSearchQuery,
  } = usePlayer();

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const renderSortIcon = (key: keyof Track) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    if (sortConfig.direction === 'asc') return <ChevronUp className="w-3 h-3 ml-1 text-white" />;
    return <ChevronDown className="w-3 h-3 ml-1 text-white" />;
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/30 relative h-full">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-4 md:px-8 border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-10 shrink-0 gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Mobile Menu Trigger */}
          <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <DialogTrigger render={
              <Button variant="ghost" size="icon" className="md:hidden text-zinc-400 hover:text-white shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            } />
            <DialogContent className="bg-black border-zinc-900 p-0 sm:max-w-xs h-full absolute left-0 top-0 rounded-none w-64 block">
              <Sidebar />
            </DialogContent>
          </Dialog>

          <div className="relative w-full max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
            <Input 
              placeholder="Search archive..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-black border-zinc-800 text-white focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:border-zinc-700 transition-all rounded-md h-10 placeholder:text-zinc-600"
            />
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <Dialog>
            <DialogTrigger render={
              <Button className="bg-white hover:bg-zinc-200 text-black gap-2 h-10 px-5 rounded-md font-medium transition-colors">
                <CloudUpload className="w-4 h-4" />
                Upload
              </Button>
            } />
            <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-md rounded-xl p-6">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-xl font-semibold">Add to Archive</DialogTitle>
              </DialogHeader>
              <div className="space-y-8 py-2">
                <div className="space-y-3">
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Link</label>
                  <div className="flex gap-2">
                    <Input placeholder="YouTube or SoundCloud URL..." className="bg-black border-zinc-800 rounded-md h-10 focus-visible:ring-zinc-700" />
                    <Button variant="secondary" className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-md h-10 w-10 p-0 border border-zinc-800 shrink-0">
                      <LinkIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="relative flex justify-center my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-zinc-900" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                    <span className="bg-zinc-950 px-4 text-zinc-600">Or</span>
                  </div>
                </div>
                <div className="border border-dashed border-zinc-700 rounded-xl p-10 flex flex-col items-center justify-center text-center gap-4 hover:border-zinc-500 hover:bg-zinc-900/80 transition-all cursor-pointer group bg-black/50">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:bg-zinc-800 transition-colors">
                    <CloudUpload className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-300">Drag & drop files</p>
                    <p className="text-xs text-zinc-600 mt-1">MP3, WAV, FLAC (Max 50MB)</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-8">
                <Button className="w-full bg-white hover:bg-zinc-200 text-black rounded-md h-12 text-sm font-bold tracking-widest uppercase">
                  Upload to Shared Library
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-8 py-8">
          <h2 className="text-3xl font-bold text-white mb-8 tracking-tight">
            {activeFilter.value}
          </h2>

          {/* Table */}
          <div className="rounded-xl border border-zinc-900 bg-black/50 overflow-x-auto w-full">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-zinc-900/30 select-none">
                <TableRow className="border-zinc-900 hover:bg-transparent">
                  <TableHead className="w-12 text-center h-11">#</TableHead>
                  <TableHead 
                    className="text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center">Title {renderSortIcon('title')}</div>
                  </TableHead>
                  <TableHead 
                    className="text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('artist')}
                  >
                    <div className="flex items-center">Artist {renderSortIcon('artist')}</div>
                  </TableHead>
                  <TableHead 
                    className="text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('bpm')}
                  >
                    <div className="flex items-center">BPM {renderSortIcon('bpm')}</div>
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Key</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Format</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Stems</TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTracks.map((track, index) => (
                  <TableRow 
                    key={track.id} 
                    className={`border-zinc-900 hover:bg-zinc-900/40 group transition-colors cursor-pointer ${currentTrack.id === track.id ? 'bg-zinc-900/20' : ''}`}
                    onClick={() => {
                      if (currentTrack.id === track.id) {
                        setIsPlaying(!isPlaying);
                      } else {
                        setCurrentTrack(track);
                        setIsPlaying(true);
                      }
                    }}
                  >
                    <TableCell className="w-12 text-center text-zinc-600 relative">
                      <span className={`transition-opacity ${currentTrack.id === track.id ? 'opacity-0' : 'group-hover:opacity-0'}`}>{index + 1}</span>
                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${currentTrack.id === track.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {currentTrack.id === track.id && isPlaying ? (
                          <Pause className="w-4 h-4 text-white fill-white" />
                        ) : (
                          <Play className="w-4 h-4 text-white fill-white" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className={`text-sm ${currentTrack.id === track.id ? 'text-white' : 'text-zinc-200'}`}>
                        {track.title}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">{track.artist}</TableCell>
                    <TableCell className="text-zinc-400 text-sm font-mono">{track.bpm}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-zinc-300">
                        {track.key}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900">
                        {track.format}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        {track.stems === 'Ready' && <span className="text-zinc-300 border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 rounded">Ready</span>}
                        {track.stems === 'Processing' && <span className="text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1.5 w-fit"><span className="w-1 h-1 rounded-full bg-zinc-400 animate-pulse"></span>Proc</span>}
                        {track.stems === 'Failed' && <span className="text-zinc-600 border border-zinc-900 px-1.5 py-0.5 rounded line-through">Failed</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <button className="flex items-center justify-center h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800/50 data-[state=open]:bg-zinc-800/50 data-[state=open]:text-white rounded-md transition-colors outline-none cursor-pointer">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        } />
                        <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-zinc-800 text-zinc-300 rounded-lg p-1 shadow-2xl">
                          <DropdownMenuItem className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2">
                            <Download className="w-4 h-4 mr-2" /> <span className="text-sm">Download</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2">
                            <Settings2 className="w-4 h-4 mr-2" /> <span className="text-sm">Stems Options</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-zinc-800 my-1" />
                          <DropdownMenuItem className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2">
                            <Pencil className="w-4 h-4 mr-2" /> <span className="text-sm">Edit Info</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="focus:!bg-red-950/50 focus:!text-red-400 hover:!bg-red-950/50 hover:!text-red-400 text-red-500 cursor-pointer rounded-md py-2">
                            <Trash className="w-4 h-4 mr-2" /> <span className="text-sm">Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredTracks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                      No tracks found in this category.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </main>
  );
}
