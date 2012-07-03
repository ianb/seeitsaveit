"""
A parser that keeps lots of information around, so the file can be
reconstructed almost exactly like it originally was entered.  Also, if
there are errors with values, they can be tracked back to a file and
line number.
"""

from iniparser import INIParser, ParseError

class ConversionError(Exception):
    pass

def canonical_name(name):
    return name.lower().replace(' ', '').replace('_', '')

class LazyINIParser(INIParser):

    def __init__(self, allow_empty_sections=False):
        self.allow_empty_sections = allow_empty_sections
        INIParser.__init__(self)

    def reset(self):
        self.configuration = Configuration()
        self.last_comment = []

    def add_comment(self, line):
        if line.startswith(' '):
            line = line[1:]
        self.last_comment.append(line)

    def assignment(self, name, content):
        item = Item(section=self.section,
                    name=name,
                    content=content,
                    comment='\n'.join(self.last_comment),
                    filename=self.filename,
                    lineno=self.start_lineno)
        self.last_comment = []
        if not self.section:
            self.new_section('')
        self.section.add_item(item)

    def new_section(self, section):
        if not section and not self.allow_empty_sections:
            self.error_no_section_name()
        self.section = Section(
            name=section.strip(),
            comment='\n'.join(self.last_comment))
        self.configuration.add_section(self.section)
        self.last_comment = []

class Configuration(object):

    def __init__(self):
        self.sections = []
        self.sections_by_name = {}

    def add_section(self, section):
        self.sections.append(section)
        # @@: I shouldn't be doing this here, I'll do it in lazyloader
        #names = self.split_names(section.name)
        #d = self.sections_by_name
        #for name in names[:-1]:
        #    d = d.setdefault(name, {})
        #d.setdefault(names[-1], []).append(section)

    def split_names(self, name):
        names = []
        while 1:
            dot_pos = name.find('.')
            paren_pos = name.find('(')
            if dot_pos == -1 and paren_pos == -1:
                next = canonical_name(name)
                if next:
                    names.append(next)
                return names
            if (dot_pos == -1 or (dot_pos > paren_pos
                                  and paren_pos != -1)):
                next = canonical_name(name[:paren_pos])
                if next:
                    names.append(next)
                name = name[paren_pos+1:]
                next_pos = name.find(')')
                assert next_pos != -1, (
                    "Bad section name, ) expected: %r" % name)
                names.append(name[:next_pos])
                name = name[next_pos+1:]
            else:
                assert dot_pos != -1
                assert paren_pos == -1 or dot_pos < paren_pos
                next = canonical_name(name[:dot_pos])
                assert next, (
                    "Empty name")
                names.append(next)
                name = name[dot_pos+1:]

    def source(self):
        return '\n\n'.join([s.source() for s in self.sections])

class Section(object):

    def __init__(self, name, comment):
        self.name = name
        self.comment = comment
        self.items = []
        self.canonical = {}

    def add_item(self, item):
        self.items.append(item)
        self.canonical.setdefault(
            canonical_name(item.name), []).append(item)

    def __repr__(self):
        return '<%s name=%r>' % (self.__class__.__name__, self.name)

    def source(self):
        s = ''
        if self.comment:
            s += '\n'.join(['# ' + l
                            for l in self.comment.splitlines()]) + '\n'
        s += '[%s]\n' % self.name
        s += ''.join([i.source() for i in self.items])
        return s


class Item(object):

    def __init__(self, section, name, content, comment,
                 filename, lineno):
        self.section = section
        self.name = name
        self.content = content
        self.comment = comment
        self.filename = filename
        self.lineno = lineno

    def value(self, name, converter=None, catch_all_exceptions=False):
        if catch_all_exceptions:
            ExcClass = Exception
        else:
            ExcClass = ConversionError
        if converter is not None:
            try:
                return converter(self.content)
            except ExcClass, e:
                msg = str(e)
                raise ParseError(
                    msg,
                    filename=self.filename,
                    lineno=self.lineno,
                    column=None)
        else:
            return self.content

    def __str__(self):
        return self.content

    def __repr__(self):
        return '<%s name=%r; value=%r>' % (
            self.__class__.__name__, self.name, self.content)

    def source(self):
        s = ''
        if self.comment:
            s += '\n'.join(['# ' + l
                            for l in self.comment.splitlines()]) + '\n'
        s += '%s = %s\n' % (self.name, self.content)
        return s
